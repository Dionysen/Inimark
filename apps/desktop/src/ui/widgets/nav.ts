export interface NavItemOptions {
  id: string;
  label: string;
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
  btn.textContent = options.label;
  if (options.onClick) btn.addEventListener("click", options.onClick);
  return btn;
}
