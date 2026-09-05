export interface MenuItemOptions {
  label: string;
  /** Inline SVG / HTML shown to the left of the label. */
  icon?: string;
  meta?: string;
  title?: string;
  selected?: boolean;
  /** Destructive action — red label/icon. */
  danger?: boolean;
  /** Show a trailing checkmark (sort menus, etc.). */
  checked?: boolean;
  onClick?: () => void;
}

export interface MenuController {
  el: HTMLDivElement;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  clear(): void;
  setPath(text: string, title?: string): void;
  addHeading(text: string): void;
  addItem(options: MenuItemOptions): HTMLButtonElement;
  addDivider(): void;
  setEmpty(text: string): void;
  destroy(): void;
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

  return {
    el,
    setOpen(next) {
      open = next;
      el.hidden = !next;
      el.classList.toggle("is-open", next);
    },
    isOpen() {
      return open;
    },
    clear() {
      body.replaceChildren();
    },
    setPath(text, title) {
      path.textContent = text;
      path.title = title ?? text;
      path.hidden = !text;
    },
    addHeading(text) {
      const heading = document.createElement("p");
      heading.className = "inimark-menu__heading";
      heading.textContent = text;
      body.append(heading);
    },
    addItem(options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-menu-item";
      btn.setAttribute("role", "menuitem");
      if (options.title) btn.title = options.title;
      if (options.selected) btn.classList.add("is-selected");
      if (options.danger) btn.classList.add("is-danger");
      if (options.icon) btn.classList.add("inimark-menu-item--with-icon");
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

      const name = document.createElement("span");
      name.className = "inimark-menu-item__name";
      name.textContent = options.label;
      content.append(name);

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
        check.innerHTML =
          `<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        btn.append(check);
      }

      if (options.onClick) btn.addEventListener("click", options.onClick);
      body.append(btn);
      return btn;
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
      el.remove();
    },
  };
}

/** Compact stroke icons for menu rows (16×16 viewBox). */
export const menuIcons = {
  rename: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  copy: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.75"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  trash: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>`,
  reveal: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10 14 21 3"/></svg>`,
  external: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10 14 21 3"/></svg>`,
  folderPlus: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M12 10v6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M9 13h6"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  library: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M4 4.5h3.25v15H5.25A1.25 1.25 0 0 1 4 18.25V4.5z"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M7.25 4.5H11v15H7.25"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M11.75 5.75 20 4v14.5l-8.25 1.75V5.75z"/></svg>`,
  close: `<svg class="inimark-icon" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M18 6 6 18"/><path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="m6 6 12 12"/></svg>`,
} as const;
