import {
  treeFileIcon,
  treeFolderIcon,
  treeFolderOpenIcon,
} from "./icon-button.ts";

export type TreeItemKind = "file" | "directory";

export interface TreeItemOptions {
  kind: TreeItemKind;
  label: string;
  path: string;
  depth?: number;
  active?: boolean;
  selected?: boolean;
  expanded?: boolean;
  /** Show folder/file icon before the label. */
  showIcons?: boolean;
  /** Marks the row as movable (pointer DnD). Does not enable HTML5 drag. */
  draggable?: boolean;
  onClick?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
}

function appendKindIcon(
  row: HTMLElement,
  kind: TreeItemKind,
  expanded?: boolean,
): void {
  const icon = document.createElement("span");
  icon.className = "inimark-tree-kind-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    kind === "directory"
      ? expanded
        ? treeFolderOpenIcon()
        : treeFolderIcon()
      : treeFileIcon();
  row.append(icon);
}

export function createTreeHost(ariaLabel = "Files"): HTMLElement {
  const tree = document.createElement("nav");
  tree.className = "inimark-tree inimark-scrollbar";
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

/**
 * Tree row. Uses a `div` (not `button`) for reliable pointer interaction in WKWebView.
 */
export function createTreeItem(options: TreeItemOptions): HTMLElement {
  const depth = options.depth ?? 0;
  const row = document.createElement("div");
  row.className = `inimark-tree-item inimark-tree-item--${options.kind === "directory" ? "dir" : "file"}`;
  row.dataset.path = options.path;
  row.dataset.kind = options.kind;
  row.setAttribute("role", "treeitem");
  row.tabIndex = 0;
  row.style.setProperty("--tree-depth", String(depth));
  if (options.active) row.classList.add("is-active");
  if (options.selected) row.classList.add("is-selected");

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
    row.append(chevron);
    if (options.showIcons) appendKindIcon(row, "directory", options.expanded);
    row.append(label);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "inimark-tree-icon-spacer";
    spacer.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "inimark-tree-label";
    label.textContent = options.label;
    row.append(spacer);
    if (options.showIcons) appendKindIcon(row, "file");
    row.append(label);
  }

  if (options.draggable) {
    // Pointer-based DnD only — HTML5 `draggable` is unreliable in Tauri/WKWebView.
    row.classList.add("is-draggable");
  }

  if (options.onClick) {
    row.addEventListener("click", (event) => options.onClick?.(event));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        options.onClick?.(event as unknown as MouseEvent);
      }
    });
  }
  if (options.onContextMenu) {
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onContextMenu?.(event);
    });
  }
  return row;
}
