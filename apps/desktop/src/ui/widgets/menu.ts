export interface MenuItemOptions {
  label: string;
  meta?: string;
  title?: string;
  selected?: boolean;
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

      const name = document.createElement("span");
      name.className = "inimark-menu-item__name";
      name.textContent = options.label;
      btn.append(name);

      if (options.meta) {
        const meta = document.createElement("span");
        meta.className = "inimark-menu-item__meta";
        meta.textContent = options.meta;
        btn.append(meta);
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
