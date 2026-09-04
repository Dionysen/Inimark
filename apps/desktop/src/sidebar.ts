import { createIconButton, libraryIcon, settingsIcon } from "./ui/icon-button.ts";
import type { Workspace, WorkspaceTreeNode } from "./platform/types.ts";

export interface SidebarController {
  setWorkspace(workspace: Workspace | null): void;
  setActiveFile(path: string | null): void;
  onFileSelect(handler: (path: string) => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  onOpenSettings(handler: () => void): void;
  onCloseLibrary(handler: () => void): void;
  destroy(): void;
}

export function mountSidebar(host: HTMLElement): SidebarController {
  host.className = "inimark-sidebar";

  const header = document.createElement("div");
  header.className = "inimark-sidebar-header";

  const title = document.createElement("span");
  title.className = "inimark-sidebar-title";
  title.textContent = "Files";

  header.append(title);

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

  const dock = document.createElement("div");
  dock.className = "inimark-sidebar-dock";

  const libraryBar = document.createElement("div");
  libraryBar.className = "inimark-library-bar inimark-glass";

  const libraryBtn = document.createElement("button");
  libraryBtn.type = "button";
  libraryBtn.className = "inimark-library-bar-main";
  libraryBtn.innerHTML = `${libraryIcon()}<span class="inimark-library-bar-label">No library</span>`;
  const libraryLabel = libraryBtn.querySelector(".inimark-library-bar-label")!;

  const settingsBtn = createIconButton({
    label: "Settings",
    title: "Open settings",
  });
  settingsBtn.classList.add("inimark-library-bar-settings");
  settingsBtn.innerHTML = settingsIcon();

  libraryBar.append(libraryBtn, settingsBtn);
  dock.append(libraryBar);

  const menu = document.createElement("div");
  menu.className = "inimark-library-menu inimark-glass";
  menu.hidden = true;
  menu.setAttribute("role", "menu");

  const menuPath = document.createElement("p");
  menuPath.className = "inimark-library-menu-path";
  menuPath.textContent = "No folder selected";

  const menuOpen = document.createElement("button");
  menuOpen.type = "button";
  menuOpen.className = "inimark-library-menu-item";
  menuOpen.textContent = "Open folder…";
  menuOpen.setAttribute("role", "menuitem");

  const menuClose = document.createElement("button");
  menuClose.type = "button";
  menuClose.className = "inimark-library-menu-item";
  menuClose.textContent = "Close library";
  menuClose.setAttribute("role", "menuitem");

  menu.append(menuPath, menuOpen, menuClose);
  dock.append(menu);

  host.append(header, treeHost, dock);

  let activePath: string | null = null;
  let menuOpenState = false;
  const expanded = new Set<string>();
  const handlers = {
    fileSelect: (_path: string): void | Promise<void> => {},
    openFolder: (): void | Promise<void> => {},
    openSettings: (): void => {},
    closeLibrary: (): void => {},
  };

  function closeMenu(): void {
    menuOpenState = false;
    menu.hidden = true;
  }

  function toggleMenu(): void {
    menuOpenState = !menuOpenState;
    menu.hidden = !menuOpenState;
  }

  libraryBtn.addEventListener("click", () => toggleMenu());
  menuOpen.addEventListener("click", () => {
    closeMenu();
    void handlers.openFolder();
  });
  menuClose.addEventListener("click", () => {
    closeMenu();
    handlers.closeLibrary();
  });
  settingsBtn.addEventListener("click", () => {
    closeMenu();
    handlers.openSettings();
  });

  document.addEventListener("click", (event) => {
    if (!menuOpenState) return;
    const target = event.target as Node | null;
    if (target && dock.contains(target)) return;
    closeMenu();
  });

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

  function applyWorkspace(workspace: Workspace | null): void {
    if (!workspace) {
      currentTree = [];
      activePath = null;
      libraryLabel.textContent = "No library";
      menuPath.textContent = "No folder selected";
      menuPath.title = "";
      renderEmptyHint("No folder selected");
      return;
    }

    currentTree = workspace.tree;
    libraryLabel.textContent = workspace.rootName;
    menuPath.textContent = workspace.rootPath;
    menuPath.title = workspace.rootPath;
    expanded.clear();
    for (const node of workspace.tree) {
      if (node.kind === "directory") expanded.add(node.path);
    }
    rerender();
  }

  return {
    setWorkspace: applyWorkspace,
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
    onOpenSettings(handler) {
      handlers.openSettings = handler;
    },
    onCloseLibrary(handler) {
      handlers.closeLibrary = handler;
    },
    destroy() {
      host.replaceChildren();
    },
  };
}
