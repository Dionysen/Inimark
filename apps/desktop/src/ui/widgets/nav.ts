export interface NavItemOptions {
  id: string;
  label: string;
  /** Optional SVG markup shown before the label. */
  icon?: string;
  active?: boolean;
  onClick?: () => void;
}

export function createNavList(): HTMLDivElement {
  const list = document.createElement("div");
  list.className = "inimark-nav-list";
  return list;
}

export function createNavItem(options: NavItemOptions): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "inimark-nav-item";
  btn.dataset.section = options.id;
  if (options.active) btn.classList.add("is-active");

  if (options.icon) {
    const icon = document.createElement("span");
    icon.className = "inimark-nav-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = options.icon;
    btn.append(icon);
  }

  const label = document.createElement("span");
  label.className = "inimark-nav-item-label";
  label.textContent = options.label;
  btn.append(label);

  if (options.onClick) btn.addEventListener("click", options.onClick);
  return btn;
}

/** Update the visible label without wiping an icon. */
export function setNavItemLabel(btn: HTMLButtonElement, label: string): void {
  const labelEl = btn.querySelector(".inimark-nav-item-label");
  if (labelEl) {
    labelEl.textContent = label;
    return;
  }
  btn.textContent = label;
}
