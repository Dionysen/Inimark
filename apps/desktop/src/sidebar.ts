import { createButton } from "./ui/button.ts";
import type { Workspace, WorkspaceTreeNode } from "./platform/types.ts";

export interface SidebarController {
  setWorkspace(workspace: Workspace | null): void;
  setActiveFile(path: string | null): void;
  onFileSelect(handler: (path: string) => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  destroy(): void;
}

export function mountSidebar(host: HTMLElement): SidebarController {
  host.className = "inimark-sidebar";

  const header = document.createElement("div");
  header.className = "inimark-sidebar-header";

  const title = document.createElement("span");
  title.className = "inimark-sidebar-title";
  title.textContent = "Library";

  const openFolderBtn = createButton({
    label: "Open",
    variant: "ghost",
    title: "Open folder as library",
  });

  header.append(title, openFolderBtn);

  const treeHost = document.createElement("nav");
  treeHost.className = "inimark-tree";
  treeHost.setAttribute("aria-label", "Markdown files");

  function renderEmptyHint(text: string): void {
    treeHost.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "inimark-sidebar-empty";
    hint.textContent = text;
    treeHost.append(hint);
  }

  renderEmptyHint("No folder selected");

  host.append(header, treeHost);

  let activePath: string | null = null;
  const expanded = new Set<string>();
  const handlers = {
    fileSelect: (_path: string): void | Promise<void> => {},
    openFolder: (): void | Promise<void> => {},
  };

  openFolderBtn.addEventListener("click", () => void handlers.openFolder());

  function renderTree(nodes: WorkspaceTreeNode[], depth = 0): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      if (node.kind === "directory") {
        const isOpen = expanded.has(node.path);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "inimark-tree-item inimark-tree-item--dir";
        row.style.paddingLeft = `${0.5 + depth * 0.85}rem`;
        row.dataset.path = node.path;
        row.setAttribute("aria-expanded", isOpen ? "true" : "false");
        row.innerHTML = `<span class="inimark-tree-chevron">${isOpen ? "▾" : "▸"}</span><span class="inimark-tree-label">${node.name}</span>`;
        row.addEventListener("click", () => {
          if (expanded.has(node.path)) expanded.delete(node.path);
          else expanded.add(node.path);
          rerender();
        });
        frag.append(row);
        if (isOpen && node.children) {
          frag.append(renderTree(node.children, depth + 1));
        }
        continue;
      }

      const row = document.createElement("button");
      row.type = "button";
      row.className = "inimark-tree-item inimark-tree-item--file";
      if (node.path === activePath) row.classList.add("is-active");
      row.style.paddingLeft = `${1.35 + depth * 0.85}rem`;
      row.dataset.path = node.path;
      row.innerHTML = `<span class="inimark-tree-label">${node.name}</span>`;
      row.addEventListener("click", () => void handlers.fileSelect(node.path));
      frag.append(row);
    }
    return frag;
  }

  let currentTree: WorkspaceTreeNode[] = [];

  function rerender(): void {
    treeHost.replaceChildren();
    if (currentTree.length === 0) {
      renderEmptyHint("No markdown files in this folder");
      return;
    }
    treeHost.append(renderTree(currentTree));
  }

  return {
    setWorkspace(workspace) {
      if (!workspace) {
        currentTree = [];
        title.textContent = "Library";
        activePath = null;
        renderEmptyHint("No folder selected");
        return;
      }
      title.textContent = workspace.rootName;
      currentTree = workspace.tree;
      for (const node of workspace.tree) {
        if (node.kind === "directory") expanded.add(node.path);
      }
      rerender();
    },
    setActiveFile(path) {
      activePath = path;
      rerender();
    },
    onFileSelect(handler) {
      handlers.fileSelect = handler;
    },
    onOpenFolder(handler) {
      handlers.openFolder = handler;
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
