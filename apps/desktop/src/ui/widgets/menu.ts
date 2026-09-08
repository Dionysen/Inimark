import {
  acquireExclusiveLayer,
  releaseExclusiveLayer,
} from "../exclusive-layer.ts";
import { bindTooltip, unbindTooltip } from "./tooltip.ts";

export interface MenuItemOptions {
  label: string;
  /** Inline SVG / HTML shown to the left of the label. */
  icon?: string;
  /** Inline HTML badge shown after the label on the same row (e.g. H1–H6). */
  badge?: string;
  meta?: string;
  title?: string;
  selected?: boolean;
  /** Destructive action — red label/icon. */
  danger?: boolean;
  /** Show a trailing checkmark (sort menus, etc.). */
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface MenuSubmenuOptions {
  label: string;
  icon?: string;
  title?: string;
  /** Current value shown after the label (e.g. active appearance mode). */
  meta?: string;
  items: MenuItemOptions[];
}

export interface MenuController {
  el: HTMLDivElement;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /** True when `node` is inside the root menu or any open flyout submenu. */
  contains(node: Node | null): boolean;
  clear(): void;
  setPath(text: string, title?: string): void;
  addHeading(text: string): void;
  addItem(options: MenuItemOptions): HTMLButtonElement;
  /** Parent row that reveals a flyout submenu on hover. */
  addSubmenuItem(options: MenuSubmenuOptions): HTMLElement;
  addDivider(): void;
  setEmpty(text: string): void;
  destroy(): void;
}

const CHEVRON_RIGHT =
  `<svg class="inimark-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CHECKMARK =
  `<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function buildMenuItemButton(options: MenuItemOptions): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "inimark-menu-item";
  btn.setAttribute("role", "menuitem");
  if (options.title) bindTooltip(btn, options.title);
  if (options.selected) btn.classList.add("is-selected");
  if (options.danger) btn.classList.add("is-danger");
  if (options.icon) btn.classList.add("inimark-menu-item--with-icon");
  if (options.disabled) {
    btn.disabled = true;
    btn.classList.add("is-disabled");
    btn.setAttribute("aria-disabled", "true");
  }
  if (options.checked != null) {
    btn.classList.add("inimark-menu-item--checkable");
    if (options.checked) {
      btn.classList.add("is-checked");
      btn.setAttribute("aria-checked", "true");
    } else {
      btn.setAttribute("aria-checked", "false");
    }
  }

  if (options.icon) {
    const icon = document.createElement("span");
    icon.className = "inimark-menu-item__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = options.icon;
    btn.append(icon);
  }

  const content = document.createElement("span");
  content.className = "inimark-menu-item__content";

  const nameRow = document.createElement("span");
  nameRow.className = "inimark-menu-item__name-row";

  const name = document.createElement("span");
  name.className = "inimark-menu-item__name";
  name.textContent = options.label;
  nameRow.append(name);

  if (options.badge) {
    const badge = document.createElement("span");
    badge.className = "inimark-menu-item__badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = options.badge;
    nameRow.append(badge);
  }

  content.append(nameRow);

  if (options.meta) {
    const meta = document.createElement("span");
    meta.className = "inimark-menu-item__meta";
    meta.textContent = options.meta;
    content.append(meta);
  }

  btn.append(content);

  if (options.checked != null) {
    const check = document.createElement("span");
    check.className = "inimark-menu-item__check";
    check.setAttribute("aria-hidden", "true");
    check.innerHTML = CHECKMARK;
    btn.append(check);
  }

  if (options.onClick && !options.disabled) {
    btn.addEventListener("click", options.onClick);
  }
  return btn;
}

export function createMenu(): MenuController {
  const el = document.createElement("div");
  el.className = "inimark-menu inimark-glass";
  el.hidden = true;
  el.setAttribute("role", "menu");

  const path = document.createElement("p");
  path.className = "inimark-menu__path";

  const body = document.createElement("div");
  body.className = "inimark-menu__section";

  el.append(path, body);

  let open = false;
  const flyouts: HTMLElement[] = [];
  const submenuWraps: HTMLElement[] = [];
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCloseTimer(): void {
    if (closeTimer != null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function hideFlyouts(): void {
    clearCloseTimer();
    for (const panel of flyouts) {
      panel.hidden = true;
      panel.classList.remove("is-open");
    }
    for (const wrap of submenuWraps) {
      wrap.classList.remove("is-open");
      const trigger = wrap.querySelector<HTMLElement>(".inimark-menu-item--submenu");
      trigger?.setAttribute("aria-expanded", "false");
    }
  }

  function setOpen(next: boolean): void {
    if (next) {
      acquireExclusiveLayer(el, () => setOpen(false));
    } else if (open) {
      hideFlyouts();
      releaseExclusiveLayer(el);
    }
    open = next;
    el.hidden = !next;
    el.classList.toggle("is-open", next);
    if (!next) hideFlyouts();
  }

  function destroyFlyouts(): void {
    hideFlyouts();
    for (const panel of flyouts) panel.remove();
    flyouts.length = 0;
    submenuWraps.length = 0;
  }

  return {
    el,
    setOpen,
    isOpen() {
      return open;
    },
    contains(node) {
      if (!node) return false;
      if (el.contains(node)) return true;
      return flyouts.some((panel) => panel.contains(node));
    },
    clear() {
      destroyFlyouts();
      body.replaceChildren();
    },
    setPath(text, title) {
      path.textContent = text;
      if (text) bindTooltip(path, title ?? text);
      else unbindTooltip(path);
      path.hidden = !text;
    },
    addHeading(text) {
      const heading = document.createElement("p");
      heading.className = "inimark-menu__heading";
      heading.textContent = text;
      body.append(heading);
    },
    addItem(options) {
      const btn = buildMenuItemButton(options);
      body.append(btn);
      return btn;
    },
    addSubmenuItem(options) {
      const wrap = document.createElement("div");
      wrap.className = "inimark-menu-submenu-wrap";

      const btn = buildMenuItemButton({
        label: options.label,
        icon: options.icon,
        title: options.title,
        meta: options.meta,
      });
      btn.classList.add("inimark-menu-item--submenu");
      btn.setAttribute("aria-haspopup", "menu");
      btn.setAttribute("aria-expanded", "false");

      const arrow = document.createElement("span");
      arrow.className = "inimark-menu-item__arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = CHEVRON_RIGHT;
      btn.append(arrow);

      const panel = document.createElement("div");
      panel.className = "inimark-menu inimark-menu--submenu inimark-glass";
      panel.hidden = true;
      panel.setAttribute("role", "menu");

      const panelBody = document.createElement("div");
      panelBody.className = "inimark-menu__section";
      for (const item of options.items) {
        panelBody.append(buildMenuItemButton(item));
      }
      panel.append(panelBody);
      document.body.append(panel);
      flyouts.push(panel);
      submenuWraps.push(wrap);

      function positionPanel(): void {
        const rect = wrap.getBoundingClientRect();
        const GAP = 4;
        const width = Math.max(160, panel.offsetWidth || 160);
        const height = Math.max(40, panel.offsetHeight || 40);
        // Prefer left of the parent — More menu sits on the right edge.
        let left = rect.left - width - GAP;
        if (left < GAP) left = rect.right + GAP;
        if (left + width > window.innerWidth - GAP) {
          left = Math.max(GAP, window.innerWidth - width - GAP);
        }
        let top = rect.top;
        if (top + height > window.innerHeight - GAP) {
          top = Math.max(GAP, window.innerHeight - height - GAP);
        }
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      }

      function deactivateOtherSubmenus(): void {
        for (const other of flyouts) {
          if (other === panel) continue;
          other.hidden = true;
          other.classList.remove("is-open");
        }
        for (const otherWrap of submenuWraps) {
          if (otherWrap === wrap) continue;
          otherWrap.classList.remove("is-open");
          const trigger = otherWrap.querySelector<HTMLElement>(
            ".inimark-menu-item--submenu",
          );
          trigger?.setAttribute("aria-expanded", "false");
        }
      }

      function showPanel(): void {
        clearCloseTimer();
        deactivateOtherSubmenus();
        panel.hidden = false;
        panel.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        wrap.classList.add("is-open");
        positionPanel();
        requestAnimationFrame(positionPanel);
      }

      function scheduleHidePanel(): void {
        clearCloseTimer();
        closeTimer = setTimeout(() => {
          panel.hidden = true;
          panel.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
          wrap.classList.remove("is-open");
          closeTimer = null;
        }, 180);
      }

      wrap.addEventListener("mouseenter", showPanel);
      wrap.addEventListener("mouseleave", scheduleHidePanel);
      panel.addEventListener("mouseenter", () => {
        clearCloseTimer();
        showPanel();
      });
      panel.addEventListener("mouseleave", scheduleHidePanel);

      wrap.append(btn);
      body.append(wrap);
      return wrap;
    },
    addDivider() {
      const divider = document.createElement("div");
      divider.className = "inimark-menu__divider";
      body.append(divider);
    },
    setEmpty(text) {
      const empty = document.createElement("p");
      empty.className = "inimark-menu__empty";
      empty.textContent = text;
      body.append(empty);
    },
    destroy() {
      if (open) setOpen(false);
      destroyFlyouts();
      el.remove();
    },
  };
}

/** Compact stroke icons for menu rows (16×16 viewBox). */
export const menuIcons = {
  rename: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  copy: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  copyTo: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 11v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M9.5 14.5 12 17l2.5-2.5"/></svg>`,
  moveTo: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M8 14h8"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m13 11 3 3-3 3"/></svg>`,
  trash: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>`,
  reveal: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10 14 21 3"/></svg>`,
  external: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10 14 21 3"/></svg>`,
  folderPlus: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 10v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M9 13h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  bookmark: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  library: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M4 4.5h3.25v15H5.25A1.25 1.25 0 0 1 4 18.25V4.5z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7.25 4.5H11v15H7.25"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.75 5.75 20 4v14.5l-8.25 1.75V5.75z"/></svg>`,
  close: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 6 6 18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m6 6 12 12"/></svg>`,
  back: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 12H5"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m12 19-7-7 7-7"/></svg>`,
  forward: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m12 5 7 7-7 7"/></svg>`,
  appearance: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/></svg>`,
  sourceMode: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m8 9-4 3 4 3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="m16 9 4 3-4 3"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M13 6 11 18"/></svg>`,
} as const;
