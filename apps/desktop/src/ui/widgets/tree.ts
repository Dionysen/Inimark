export type TreeItemKind = "file" | "directory";

export interface TreeItemOptions {
  kind: TreeItemKind;
  label: string;
  path: string;
  depth?: number;
  active?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}

export function createTreeHost(ariaLabel = "Files"): HTMLElement {
  const tree = document.createElement("nav");
  tree.className = "inimark-tree";
  tree.setAttribute("aria-label", ariaLabel);
  return tree;
}

/** Branch wrapper — row + optional nested children (Inimark tree pattern). */
export function createTreeBranch(): HTMLElement {
  const el = document.createElement("div");
  el.className = "inimark-tree-branch";
  return el;
}

/**
 * Children group for an expanded directory.
 * `--tree-depth` is the *parent* depth so the guide lines up with that row's chevron.
 */
export function createTreeChildren(parentDepth: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "inimark-tree-children";
  el.style.setProperty("--tree-depth", String(parentDepth));
  return el;
}

export function createTreeItem(options: TreeItemOptions): HTMLButtonElement {
  const depth = options.depth ?? 0;
  const row = document.createElement("button");
  row.type = "button";
  row.className = `inimark-tree-item inimark-tree-item--${options.kind === "directory" ? "dir" : "file"}`;
  row.dataset.path = options.path;
  row.style.setProperty("--tree-depth", String(depth));
  if (options.active) row.classList.add("is-active");

  if (options.kind === "directory") {
    row.setAttribute("aria-expanded", options.expanded ? "true" : "false");
    const chevron = document.createElement("span");
    chevron.className = "inimark-tree-chevron";
    if (options.expanded) chevron.classList.add("is-expanded");
    chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const label = document.createElement("span");
    label.className = "inimark-tree-label";
    label.textContent = options.label;
    row.append(chevron, label);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "inimark-tree-icon-spacer";
    spacer.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "inimark-tree-label";
    label.textContent = options.label;
    row.append(spacer, label);
  }

  if (options.onClick) row.addEventListener("click", options.onClick);
  if (options.onContextMenu) {
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onContextMenu?.(event);
    });
  }
  return row;
}
