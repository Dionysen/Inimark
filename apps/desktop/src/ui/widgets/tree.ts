export type TreeItemKind = "file" | "directory";

export interface TreeItemOptions {
  kind: TreeItemKind;
  label: string;
  path: string;
  depth?: number;
  active?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}

export function createTreeHost(ariaLabel = "Files"): HTMLElement {
  const tree = document.createElement("nav");
  tree.className = "inimark-tree";
  tree.setAttribute("aria-label", ariaLabel);
  return tree;
}

export function createTreeItem(options: TreeItemOptions): HTMLButtonElement {
  const depth = options.depth ?? 0;
  const row = document.createElement("button");
  row.type = "button";
  row.className = `inimark-tree-item inimark-tree-item--${options.kind === "directory" ? "dir" : "file"}`;
  row.dataset.path = options.path;
  if (options.active) row.classList.add("is-active");

  if (options.kind === "directory") {
    row.style.paddingLeft = `${0.5 + depth * 0.85}rem`;
    row.setAttribute("aria-expanded", options.expanded ? "true" : "false");
    row.innerHTML = `<span class="inimark-tree-chevron">${options.expanded ? "▾" : "▸"}</span><span class="inimark-tree-label"></span>`;
  } else {
    row.style.paddingLeft = `${1.35 + depth * 0.85}rem`;
    row.innerHTML = `<span class="inimark-tree-label"></span>`;
  }

  const label = row.querySelector(".inimark-tree-label");
  if (label) label.textContent = options.label;
  if (options.onClick) row.addEventListener("click", options.onClick);
  return row;
}
