import {
  createIconButton,
  libraryIcon,
  settingsIcon,
} from "./ui/icon-button.ts";
import {
  createMenu,
  createTreeHost,
  createTreeItem,
} from "./ui/widgets/index.ts";
import type { LibraryRecord } from "./libraries/store.ts";
import type { Workspace, WorkspaceTreeNode } from "./platform/types.ts";

export interface SidebarController {
  setWorkspace(workspace: Workspace | null): void;
  setActiveFile(path: string | null): void;
  setSavedLibraries(libraries: LibraryRecord[], activeLibraryId: string | null): void;
  setExpandedDirs(dirs: string[]): void;
  getExpandedDirs(): string[];
  onFileSelect(handler: (path: string) => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  onOpenSettings(handler: () => void): void;
  onCloseLibrary(handler: () => void): void;
  onSwitchLibrary(handler: (libraryId: string) => void | Promise<void>): void;
  onExpandedDirsChange(handler: (dirs: string[]) => void): void;
  destroy(): void;
}

export function mountSidebar(host: HTMLElement): SidebarController {
  host.className = "inimark-sidebar";

  // Empty drag strip — 36px on macOS for traffic lights; collapsed elsewhere.
  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "");

  const treeHost = createTreeHost("Markdown files");

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

  const libraryWrap = document.createElement("div");
  libraryWrap.className = "inimark-library-bar-wrap";

  const libraryBar = document.createElement("button");
  libraryBar.type = "button";
  libraryBar.className = "inimark-library-bar";
  libraryBar.setAttribute("aria-haspopup", "menu");
  libraryBar.setAttribute("aria-expanded", "false");
  libraryBar.title = "Libraries";
  libraryBar.innerHTML = `${libraryIcon()}<span class="inimark-library-bar-label">No library</span>`;
  const libraryLabel = libraryBar.querySelector(".inimark-library-bar-label")!;

  const settingsBtn = createIconButton({
    label: "Settings",
    title: "Open settings",
  });
  settingsBtn.classList.add("inimark-library-bar-settings");
  settingsBtn.innerHTML = settingsIcon();

  libraryWrap.append(libraryBar, settingsBtn);
  dock.append(libraryWrap);

  const menu = createMenu();
  dock.append(menu.el);

  host.append(topbar, treeHost, dock);

  let activePath: string | null = null;
  let activeLibraryId: string | null = null;
  let savedLibraries: LibraryRecord[] = [];
  let workspacePath = "";
  const expanded = new Set<string>();
  const handlers = {
    fileSelect: (_path: string): void | Promise<void> => {},
    openFolder: (): void | Promise<void> => {},
    openSettings: (): void => {},
    closeLibrary: (): void => {},
    switchLibrary: (_libraryId: string): void | Promise<void> => {},
    expandedDirsChange: (_dirs: string[]): void => {},
  };

  function notifyExpandedChange(): void {
    handlers.expandedDirsChange([...expanded]);
  }

  function closeMenu(): void {
    menu.setOpen(false);
    libraryBar.setAttribute("aria-expanded", "false");
  }

  function toggleMenu(): void {
    if (menu.isOpen()) {
      closeMenu();
      return;
    }
    renderLibraryList();
    menu.setOpen(true);
    libraryBar.setAttribute("aria-expanded", "true");
  }

  function renderLibraryList(): void {
    menu.clear();
    menu.setPath(
      workspacePath || "No folder selected",
      workspacePath || undefined,
    );

    if (savedLibraries.length === 0) {
      menu.setEmpty("No saved libraries");
    } else {
      menu.addHeading("Libraries");
      for (const library of savedLibraries) {
        menu.addItem({
          label: library.rootName,
          meta: library.rootPath,
          title: library.rootPath,
          selected: library.id === activeLibraryId,
          onClick() {
            closeMenu();
            void handlers.switchLibrary(library.id);
          },
        });
      }
    }

    menu.addDivider();
    menu.addItem({
      label: "Add library…",
      onClick() {
        closeMenu();
        void handlers.openFolder();
      },
    });
    menu.addItem({
      label: "Close library",
      onClick() {
        closeMenu();
        handlers.closeLibrary();
      },
    });
  }

  libraryBar.addEventListener("click", () => toggleMenu());
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenu();
    handlers.openSettings();
  });

  document.addEventListener("click", (event) => {
    if (!menu.isOpen()) return;
    const target = event.target as Node | null;
    if (target && dock.contains(target)) return;
    closeMenu();
  });

  function renderTree(nodes: WorkspaceTreeNode[], depth = 0): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      if (node.kind === "directory") {
        const isOpen = expanded.has(node.path);
        const row = createTreeItem({
          kind: "directory",
          label: node.name,
          path: node.path,
          depth,
          expanded: isOpen,
          onClick() {
            if (expanded.has(node.path)) expanded.delete(node.path);
            else expanded.add(node.path);
            notifyExpandedChange();
            rerender();
          },
        });
        frag.append(row);
        if (isOpen && node.children) {
          frag.append(renderTree(node.children, depth + 1));
        }
        continue;
      }

      const row = createTreeItem({
        kind: "file",
        label: node.name,
        path: node.path,
        depth,
        active: node.path === activePath,
        onClick() {
          void handlers.fileSelect(node.path);
        },
      });
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
      activeLibraryId = null;
      workspacePath = "";
      libraryLabel.textContent = "No library";
      expanded.clear();
      renderEmptyHint("No folder selected");
      renderLibraryList();
      return;
    }

    currentTree = workspace.tree;
    workspacePath = workspace.rootPath;
    libraryLabel.textContent = workspace.rootName;
    rerender();
    renderLibraryList();
  }

  return {
    setWorkspace: applyWorkspace,
    setActiveFile(path) {
      activePath = path;
      rerender();
    },
    setSavedLibraries(libraries, activeId) {
      savedLibraries = libraries;
      activeLibraryId = activeId;
      renderLibraryList();
    },
    setExpandedDirs(dirs) {
      expanded.clear();
      for (const dir of dirs) expanded.add(dir);
      if (currentTree.length > 0) rerender();
    },
    getExpandedDirs() {
      return [...expanded];
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
    onSwitchLibrary(handler) {
      handlers.switchLibrary = handler;
    },
    onExpandedDirsChange(handler) {
      handlers.expandedDirsChange = handler;
    },
    destroy() {
      menu.destroy();
      host.replaceChildren();
    },
  };
}
