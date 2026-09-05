import {
  sidebarTabIcon,
  sidebarTabLabel,
  type SidebarTabId,
  type SidebarTabLayout,
} from "../sidebar/tab-layout.ts";
import { t } from "../i18n/index.ts";

export interface SidebarTabsControlOptions {
  layout: SidebarTabLayout;
  onChange(layout: SidebarTabLayout): void;
}

export interface SidebarTabsControlController {
  el: HTMLElement;
  setLayout(layout: SidebarTabLayout): void;
  refreshLabels(): void;
  destroy(): void;
}

type DragSide = "left" | "right";

interface DragState {
  id: SidebarTabId;
  from: DragSide;
  pointerId: number;
  ghost: HTMLElement;
  originX: number;
  originY: number;
}

export function createSidebarTabsControl(
  options: SidebarTabsControlOptions,
): SidebarTabsControlController {
  let layout: SidebarTabLayout = {
    left: [...options.layout.left],
    right: [...options.layout.right],
  };
  let drag: DragState | null = null;

  const el = document.createElement("div");
  el.className = "inimark-settings-sidebar-tabs";

  const title = document.createElement("div");
  title.className = "inimark-settings-row-title";

  const desc = document.createElement("p");
  desc.className = "inimark-settings-row-desc";

  const zones = document.createElement("div");
  zones.className = "inimark-settings-sidebar-tabs-zones";

  const leftZone = createZone("left");
  const rightZone = createZone("right");
  zones.append(leftZone.el, rightZone.el);

  el.append(title, desc, zones);
  refreshLabels();
  render();

  function createZone(side: DragSide): {
    el: HTMLElement;
    label: HTMLElement;
    list: HTMLElement;
  } {
    const zone = document.createElement("div");
    zone.className = "inimark-settings-sidebar-tabs-zone";
    zone.dataset.side = side;

    const label = document.createElement("div");
    label.className = "inimark-settings-sidebar-tabs-zone-label";

    const list = document.createElement("div");
    list.className = "inimark-settings-sidebar-tabs-list";
    list.setAttribute("role", "list");

    zone.append(label, list);
    return { el: zone, label, list };
  }

  function refreshLabels(): void {
    title.textContent = t("settings.appearance.sidebarTabs");
    desc.textContent = t("settings.appearance.sidebarTabsDesc");
    leftZone.label.textContent = t("settings.appearance.sidebarTabsLeft");
    rightZone.label.textContent = t("settings.appearance.sidebarTabsRight");
    render();
  }

  function render(): void {
    renderList(leftZone.list, layout.left, "left");
    renderList(rightZone.list, layout.right, "right");
  }

  function renderList(
    list: HTMLElement,
    ids: SidebarTabId[],
    side: DragSide,
  ): void {
    list.replaceChildren();
    if (ids.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inimark-settings-sidebar-tabs-empty";
      empty.textContent = t("settings.appearance.sidebarTabsEmpty");
      list.append(empty);
      return;
    }
    for (const id of ids) {
      list.append(createChip(id, side));
    }
  }

  function createChip(id: SidebarTabId, side: DragSide): HTMLElement {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "inimark-settings-sidebar-tabs-chip";
    chip.dataset.tab = id;
    const label = sidebarTabLabel(id);
    chip.title = label;
    chip.setAttribute("aria-label", label);
    chip.setAttribute("role", "listitem");
    chip.innerHTML = sidebarTabIcon(id);

    chip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startDrag(id, side, chip, event);
    });

    return chip;
  }

  function startDrag(
    id: SidebarTabId,
    from: DragSide,
    chip: HTMLElement,
    event: PointerEvent,
  ): void {
    if (drag) return;

    const rect = chip.getBoundingClientRect();
    const ghost = chip.cloneNode(true) as HTMLElement;
    ghost.classList.add("is-drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.append(ghost);

    chip.classList.add("is-dragging");
    chip.setPointerCapture(event.pointerId);

    drag = {
      id,
      from,
      pointerId: event.pointerId,
      ghost,
      originX: event.clientX - rect.left,
      originY: event.clientY - rect.top,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!drag || moveEvent.pointerId !== drag.pointerId) return;
      drag.ghost.style.left = `${moveEvent.clientX - drag.originX}px`;
      drag.ghost.style.top = `${moveEvent.clientY - drag.originY}px`;
      updateDropPreview(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent: PointerEvent) => {
      if (!drag || upEvent.pointerId !== drag.pointerId) return;
      const drop = resolveDrop(upEvent.clientX, upEvent.clientY);
      finishDrag();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (drop) moveTab(id, drop.side, drop.beforeId);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function finishDrag(): void {
    if (!drag) return;
    drag.ghost.remove();
    leftZone.el.classList.remove("is-drop-target");
    rightZone.el.classList.remove("is-drop-target");
    clearGhost(leftZone.list);
    clearGhost(rightZone.list);
    el.querySelectorAll(".inimark-settings-sidebar-tabs-chip.is-dragging").forEach(
      (node) => node.classList.remove("is-dragging"),
    );
    drag = null;
  }

  function zoneAtPoint(clientX: number, clientY: number): DragSide | null {
    const leftRect = leftZone.el.getBoundingClientRect();
    const rightRect = rightZone.el.getBoundingClientRect();
    if (
      clientX >= leftRect.left &&
      clientX <= leftRect.right &&
      clientY >= leftRect.top &&
      clientY <= leftRect.bottom
    ) {
      return "left";
    }
    if (
      clientX >= rightRect.left &&
      clientX <= rightRect.right &&
      clientY >= rightRect.top &&
      clientY <= rightRect.bottom
    ) {
      return "right";
    }
    return null;
  }

  function updateDropPreview(clientX: number, clientY: number): void {
    if (!drag) return;
    const side = zoneAtPoint(clientX, clientY);
    leftZone.el.classList.toggle("is-drop-target", side === "left");
    rightZone.el.classList.toggle("is-drop-target", side === "right");
    clearGhost(leftZone.list);
    clearGhost(rightZone.list);
    if (!side) return;
    const list = side === "left" ? leftZone.list : rightZone.list;
    const beforeId = insertionTarget(list, clientX, drag.id);
    updateGhost(list, beforeId);
  }

  function resolveDrop(
    clientX: number,
    clientY: number,
  ): { side: DragSide; beforeId: SidebarTabId | null } | null {
    if (!drag) return null;
    const side = zoneAtPoint(clientX, clientY);
    if (!side) return null;
    const list = side === "left" ? leftZone.list : rightZone.list;
    return {
      side,
      beforeId: insertionTarget(list, clientX, drag.id),
    };
  }

  function insertionTarget(
    list: HTMLElement,
    clientX: number,
    draggingId: SidebarTabId,
  ): SidebarTabId | null {
    const chips = [
      ...list.querySelectorAll<HTMLElement>(".inimark-settings-sidebar-tabs-chip"),
    ].filter((chip) => chip.dataset.tab !== draggingId);
    for (const chip of chips) {
      const rect = chip.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (clientX < mid) {
        const id = chip.dataset.tab;
        return id ? (id as SidebarTabId) : null;
      }
    }
    return null;
  }

  function updateGhost(list: HTMLElement, beforeId: SidebarTabId | null): void {
    clearGhost(list);
    const ghost = document.createElement("div");
    ghost.className = "inimark-settings-sidebar-tabs-ghost";
    ghost.setAttribute("aria-hidden", "true");
    if (!beforeId) {
      list.append(ghost);
      return;
    }
    const target = list.querySelector<HTMLElement>(`[data-tab="${beforeId}"]`);
    if (target) list.insertBefore(ghost, target);
    else list.append(ghost);
  }

  function clearGhost(list: HTMLElement): void {
    list
      .querySelectorAll(".inimark-settings-sidebar-tabs-ghost")
      .forEach((node) => node.remove());
  }

  function moveTab(
    id: SidebarTabId,
    to: DragSide,
    beforeId: SidebarTabId | null,
  ): void {
    const next: SidebarTabLayout = {
      left: layout.left.filter((tab) => tab !== id),
      right: layout.right.filter((tab) => tab !== id),
    };
    const target = to === "left" ? next.left : next.right;
    const insertAt =
      beforeId == null ? target.length : Math.max(0, target.indexOf(beforeId));
    const at = beforeId == null || insertAt < 0 ? target.length : insertAt;
    // No-op if order/side unchanged.
    const prevLeft = layout.left.join(",");
    const prevRight = layout.right.join(",");
    target.splice(at, 0, id);
    if (next.left.join(",") === prevLeft && next.right.join(",") === prevRight) {
      render();
      return;
    }
    layout = next;
    render();
    options.onChange({
      left: [...layout.left],
      right: [...layout.right],
    });
  }

  return {
    el,
    setLayout(next) {
      layout = { left: [...next.left], right: [...next.right] };
      render();
    },
    refreshLabels,
    destroy() {
      finishDrag();
      el.replaceChildren();
    },
  };
}
