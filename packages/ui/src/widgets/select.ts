import {
  applyOverlayPosition,
  onOutsideClick,
  onScrollDismiss,
  positionBelowOrAbove,
} from "./overlay.ts";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface SelectOptions {
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  title?: string;
  minWidth?: number | string;
  /** Dropdown panel width matches the trigger (no global minimum). */
  matchTriggerWidth?: boolean;
  /** Show a search field at the top of the dropdown. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onChange?: (value: string) => void;
}

export interface SelectController {
  el: HTMLDivElement;
  setValue(value: string): void;
  getValue(): string;
  setOptions(options: SelectOption[]): void;
  destroy(): void;
}

const CHEVRON = `<svg class="inimark-select__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

export function createSelect(options: SelectOptions): SelectController {
  let current = options.value;
  let items = [...options.options];
  let open = false;
  let query = "";
  let activeIndex = -1;
  let stopOutside: (() => void) | null = null;
  let stopScrollDismiss: (() => void) | null = null;
  const searchable = Boolean(options.searchable);

  const root = document.createElement("div");
  root.className = "inimark-select";
  if (options.minWidth != null) {
    root.style.minWidth =
      typeof options.minWidth === "number" ? `${options.minWidth}px` : options.minWidth;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "inimark-control inimark-field inimark-select__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (options.title) trigger.title = options.title;
  if (options.disabled) trigger.disabled = true;

  const label = document.createElement("span");
  label.className = "inimark-select__label";

  trigger.insertAdjacentHTML("beforeend", CHEVRON);
  trigger.prepend(label);

  const panel = document.createElement("div");
  panel.className = searchable
    ? "inimark-select-panel inimark-select-panel--searchable"
    : "inimark-select-panel inimark-scrollbar";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  const search = document.createElement("input");
  search.type = "search";
  search.className = "inimark-select-search";
  search.placeholder = options.searchPlaceholder ?? "Search…";
  search.autocomplete = "off";
  search.spellcheck = false;

  const list = document.createElement("div");
  list.className = searchable
    ? "inimark-select-list inimark-scrollbar"
    : "inimark-select-list";

  if (searchable) {
    panel.append(search, list);
  }

  function labelFor(value: string): string {
    return items.find((item) => item.value === value)?.label ?? value;
  }

  function syncLabel(): void {
    label.textContent = labelFor(current);
  }

  function filteredItems(): SelectOption[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.group?.toLowerCase().includes(q) ?? false),
    );
  }

  function optionsHost(): HTMLElement {
    return searchable ? list : panel;
  }

  function close(): void {
    if (!open) return;
    open = false;
    query = "";
    activeIndex = -1;
    search.value = "";
    root.classList.remove("is-open");
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    panel.classList.remove("is-open");
    panel.hidden = true;
    stopOutside?.();
    stopOutside = null;
    stopScrollDismiss?.();
    stopScrollDismiss = null;
    if (searchable) panel.remove();
  }

  function scrollActiveIntoView(): void {
    if (activeIndex < 0) return;
    const buttons = optionsHost().querySelectorAll<HTMLButtonElement>(".inimark-select-option");
    buttons[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function renderOptions(): void {
    const host = optionsHost();
    host.replaceChildren();
    const filtered = filteredItems();
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inimark-select-empty";
      empty.textContent = options.emptyMessage ?? "No matches";
      host.append(empty);
      return;
    }

    let lastGroup: string | undefined;
    filtered.forEach((item, index) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const group = document.createElement("div");
        group.className = "inimark-select-group";
        group.textContent = item.group;
        host.append(group);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-select-option";
      btn.setAttribute("role", "option");
      btn.dataset.value = item.value;
      btn.dataset.index = String(index);
      btn.textContent = item.label;
      if (item.value === current) btn.classList.add("is-selected");
      if (index === activeIndex) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        current = item.value;
        syncLabel();
        options.onChange?.(current);
        close();
      });
      host.append(btn);
    });
    requestAnimationFrame(() => scrollActiveIntoView());
  }

  function openPanel(): void {
    if (open || trigger.disabled) return;
    open = true;
    query = "";
    search.value = "";
    const filtered = filteredItems();
    activeIndex = Math.max(
      0,
      filtered.findIndex((item) => item.value === current),
    );
    renderOptions();
    root.classList.add("is-open");
    trigger.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    panel.classList.toggle(
      "inimark-select-panel--match-trigger",
      Boolean(options.matchTriggerWidth),
    );
    document.body.append(panel);
    const pos = positionBelowOrAbove(
      trigger.getBoundingClientRect(),
      searchable ? 320 : 280,
      4,
      options.matchTriggerWidth ? 0 : 140,
    );
    applyOverlayPosition(panel, pos);
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
      if (searchable) search.focus();
    });
    stopOutside = onOutsideClick([root, panel], close);
    stopScrollDismiss = onScrollDismiss(panel, close);
  }

  function toggle(): void {
    if (open) close();
    else openPanel();
  }

  function moveActive(delta: 1 | -1): void {
    const count = filteredItems().length;
    if (count === 0) {
      activeIndex = -1;
      renderOptions();
      return;
    }
    if (activeIndex < 0) {
      activeIndex = delta > 0 ? 0 : count - 1;
    } else {
      activeIndex = Math.max(0, Math.min(count - 1, activeIndex + delta));
    }
    renderOptions();
  }

  function commitActive(): void {
    const item = filteredItems()[activeIndex];
    if (!item) return;
    current = item.value;
    syncLabel();
    options.onChange?.(current);
    close();
  }

  trigger.addEventListener("click", toggle);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openPanel();
      else moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openPanel();
      else moveActive(-1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      commitActive();
      return;
    }
    if (event.key === "Escape") {
      close();
    }
  });

  if (searchable) {
    search.addEventListener("input", () => {
      query = search.value;
      activeIndex = 0;
      renderOptions();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitActive();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.focus();
      }
    });
  }

  root.append(trigger);
  syncLabel();

  return {
    el: root,
    setValue(value) {
      current = value;
      syncLabel();
      if (open) renderOptions();
    },
    getValue() {
      return current;
    },
    setOptions(next) {
      items = [...next];
      syncLabel();
      if (open) renderOptions();
    },
    destroy() {
      close();
      panel.remove();
      root.remove();
    },
  };
}
