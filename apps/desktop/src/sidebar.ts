import {
  bookmarksTabIcon,
  createIconButton,
  createMenu,
  createSearchField,
  createTreeBranch,
  createTreeChildren,
  createTreeHost,
  createTreeItem,
  filesTabIcon,
  libraryIcon,
  searchTabIcon,
  settingsIcon,
  sidebarToggleIcon,
} from "./ui/widgets/index.ts";
import type { LibraryRecord } from "./libraries/store.ts";
import type { Workspace, WorkspaceTreeNode } from "./platform/types.ts";
import {
  highlightMatch,
  searchVaultIncremental,
  type VaultSearchResult,
} from "./sidebar/vault-search.ts";

export type SidebarPanelId = "files" | "search" | "bookmarks";

const SIDEBAR_PANEL_KEY = "inimark-sidebar-panel";

const PANEL_META: Record<
  SidebarPanelId,
  { label: string; icon: () => string }
> = {
  files: { label: "Files", icon: filesTabIcon },
  search: { label: "Search", icon: searchTabIcon },
  bookmarks: { label: "Bookmarks", icon: bookmarksTabIcon },
};

export type FileSelectOptions = {
  line?: number;
  query?: string;
  snippet?: string;
};

export interface SidebarController {
  setWorkspace(workspace: Workspace | null): void;
  setActiveFile(path: string | null): void;
  setSavedLibraries(libraries: LibraryRecord[], activeLibraryId: string | null): void;
  setExpandedDirs(dirs: string[]): void;
  getExpandedDirs(): string[];
  setSidebarOpen(open: boolean): void;
  onToggleSidebar(handler: () => void): void;
  onFileSelect(handler: (path: string, options?: FileSelectOptions) => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  onOpenSettings(handler: () => void): void;
  onCloseLibrary(handler: () => void): void;
  onSwitchLibrary(handler: (libraryId: string) => void | Promise<void>): void;
  onExpandedDirsChange(handler: (dirs: string[]) => void): void;
  destroy(): void;
}

function loadActivePanel(): SidebarPanelId {
  try {
    const saved = localStorage.getItem(SIDEBAR_PANEL_KEY);
    if (saved === "files" || saved === "search" || saved === "bookmarks") return saved;
  } catch {
    /* ignore */
  }
  return "files";
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

export function mountSidebar(host: HTMLElement): SidebarController {
  host.className = "inimark-sidebar";

  // Topbar: tabs + collapse toggle (Obsidian-style; traffic lights pad on macOS).
  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "");

  const tabs = document.createElement("div");
  tabs.className = "inimark-sidebar-tabs";
  tabs.setAttribute("role", "tablist");
  markNoDrag(tabs);

  const tabButtons = new Map<SidebarPanelId, HTMLButtonElement>();
  for (const id of Object.keys(PANEL_META) as SidebarPanelId[]) {
    const meta = PANEL_META[id];
    const btn = createIconButton({
      label: meta.label,
      title: meta.label,
    });
    btn.className = "inimark-sidebar-tab";
    btn.setAttribute("role", "tab");
    btn.dataset.panel = id;
    btn.innerHTML = meta.icon();
    markNoDrag(btn);
    tabButtons.set(id, btn);
    tabs.append(btn);
  }

  const collapseBtn = createIconButton({
    label: "Collapse sidebar",
    title: "Collapse sidebar",
  });
  collapseBtn.className = "inimark-sidebar-toggle-btn inimark-sidebar-collapse-btn";
  collapseBtn.innerHTML = sidebarToggleIcon(true);
  markNoDrag(collapseBtn);

  topbar.append(tabs, collapseBtn);

  const body = document.createElement("div");
  body.className = "inimark-sidebar-body";

  const filesPanel = document.createElement("div");
  filesPanel.className = "inimark-sidebar-panel";
  filesPanel.dataset.panel = "files";
  filesPanel.setAttribute("role", "tabpanel");
  const treeHost = createTreeHost("Markdown files");
  filesPanel.append(treeHost);

  const searchPanel = document.createElement("div");
  searchPanel.className = "inimark-sidebar-panel";
  searchPanel.dataset.panel = "search";
  searchPanel.setAttribute("role", "tabpanel");
  searchPanel.hidden = true;

  const searchField = createSearchField({
    placeholder: "Search…",
    onInput(value) {
      searchQuery = value;
      scheduleSearch();
    },
  });
  const searchMeta = document.createElement("div");
  searchMeta.className = "inimark-sidebar-search-meta";
  searchMeta.hidden = true;
  const searchResults = document.createElement("div");
  searchResults.className = "inimark-sidebar-search-results inimark-scroll-target";
  searchPanel.append(searchField.el, searchMeta, searchResults);

  const bookmarksPanel = document.createElement("div");
  bookmarksPanel.className = "inimark-sidebar-panel";
  bookmarksPanel.dataset.panel = "bookmarks";
  bookmarksPanel.setAttribute("role", "tabpanel");
  bookmarksPanel.hidden = true;
  const bookmarksEmpty = document.createElement("p");
  bookmarksEmpty.className = "inimark-sidebar-empty";
  bookmarksEmpty.textContent = "No bookmarks yet";
  bookmarksPanel.append(bookmarksEmpty);

  body.append(filesPanel, searchPanel, bookmarksPanel);

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

  host.append(topbar, body, dock);

  let activePath: string | null = null;
  let activeLibraryId: string | null = null;
  let savedLibraries: LibraryRecord[] = [];
  let workspacePath = "";
  let currentWorkspace: Workspace | null = null;
  let activePanel: SidebarPanelId = loadActivePanel();
  let searchQuery = "";
  let searchHits: VaultSearchResult[] = [];
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let searchSignal: { cancelled: boolean } = { cancelled: false };
  let searching = false;
  const collapsedSearchFiles = new Set<string>();
  const expanded = new Set<string>();
  const handlers = {
    fileSelect: (_path: string, _options?: FileSelectOptions): void | Promise<void> => {},
    openFolder: (): void | Promise<void> => {},
    openSettings: (): void => {},
    closeLibrary: (): void => {},
    switchLibrary: (_libraryId: string): void | Promise<void> => {},
    expandedDirsChange: (_dirs: string[]): void => {},
    toggleSidebar: (): void => {},
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
  collapseBtn.addEventListener("click", () => handlers.toggleSidebar());

  document.addEventListener("click", (event) => {
    if (!menu.isOpen()) return;
    const target = event.target as Node | null;
    if (target && dock.contains(target)) return;
    closeMenu();
  });

  function setActivePanel(panel: SidebarPanelId): void {
    activePanel = panel;
    try {
      localStorage.setItem(SIDEBAR_PANEL_KEY, panel);
    } catch {
      /* ignore */
    }

    for (const [id, btn] of tabButtons) {
      const selected = id === panel;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    }

    filesPanel.hidden = panel !== "files";
    searchPanel.hidden = panel !== "search";
    bookmarksPanel.hidden = panel !== "bookmarks";

    if (panel === "search") {
      queueMicrotask(() => searchField.focus());
      scheduleSearch();
    }
  }

  for (const [id, btn] of tabButtons) {
    btn.addEventListener("click", () => setActivePanel(id));
  }

  function renderTree(nodes: WorkspaceTreeNode[], depth = 0): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      const branch = createTreeBranch();

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
        branch.append(row);
        if (isOpen && node.children && node.children.length > 0) {
          const children = createTreeChildren(depth);
          children.append(renderTree(node.children, depth + 1));
          branch.append(children);
        }
        frag.append(branch);
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
      branch.append(row);
      frag.append(branch);
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

  function cancelSearch(): void {
    if (searchTimer != null) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    searchSignal.cancelled = true;
    searching = false;
  }

  function clearSearchUi(): void {
    searchHits = [];
    searchMeta.hidden = true;
    searchMeta.replaceChildren();
    searchResults.replaceChildren();
  }

  function scheduleSearch(): void {
    cancelSearch();
    const q = searchQuery.trim();
    if (!q) {
      clearSearchUi();
      return;
    }
    if (!currentWorkspace) {
      clearSearchUi();
      return;
    }

    searchTimer = setTimeout(() => {
      searchTimer = null;
      void runSearch(q);
    }, 160);
  }

  async function runSearch(query: string): Promise<void> {
    if (!currentWorkspace) {
      clearSearchUi();
      return;
    }

    const signal = { cancelled: false };
    searchSignal = signal;
    searching = true;
    searchHits = [];
    renderSearchResults();

    await searchVaultIncremental(
      currentWorkspace,
      query,
      (batch) => {
        if (signal.cancelled) return;
        searchHits = batch;
        renderSearchResults();
      },
      signal,
    );

    if (signal.cancelled) return;
    searching = false;
    renderSearchResults();
  }

  function renderSearchResults(): void {
    const q = searchQuery.trim();
    searchResults.replaceChildren();

    if (!q) {
      searchMeta.hidden = true;
      searchMeta.replaceChildren();
      return;
    }

    const matchCount = searchHits.reduce(
      (sum, hit) => sum + Math.max(hit.matches.length, hit.nameMatch ? 1 : 0),
      0,
    );

    searchMeta.hidden = false;
    searchMeta.replaceChildren();
    const countEl = document.createElement("span");
    countEl.className = "inimark-sidebar-search-count";
    if (searching && searchHits.length === 0) {
      countEl.textContent = "Searching…";
    } else if (searching) {
      countEl.textContent = `${matchCount} results…`;
    } else {
      countEl.textContent =
        matchCount === 1 ? "1 result" : `${matchCount} results`;
    }
    searchMeta.append(countEl);

    if (!searching && searchHits.length === 0) {
      const hint = document.createElement("p");
      hint.className = "inimark-sidebar-empty";
      hint.textContent = "No matches found";
      searchResults.append(hint);
      return;
    }

    const list = document.createElement("div");
    list.className = "inimark-sidebar-search-list";

    for (const hit of searchHits) {
      const group = document.createElement("div");
      group.className = "inimark-sidebar-search-group";
      if (hit.path === activePath) group.classList.add("is-active");

      const collapsed = collapsedSearchFiles.has(hit.path);
      const badgeCount = hit.matches.length > 0 ? hit.matches.length : hit.nameMatch ? 1 : 0;

      const header = document.createElement("button");
      header.type = "button";
      header.className = "inimark-sidebar-search-file";
      header.title = hit.path;

      const chevron = document.createElement("span");
      chevron.className = "inimark-tree-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = collapsed ? "▸" : "▾";

      const name = document.createElement("span");
      name.className = "inimark-sidebar-search-file-name";
      name.append(highlightMatch(hit.fileName, q));

      const badge = document.createElement("span");
      badge.className = "inimark-sidebar-search-badge";
      badge.textContent = String(badgeCount);

      header.append(chevron, name, badge);

      header.addEventListener("click", () => {
        void handlers.fileSelect(hit.path);
      });

      chevron.addEventListener("click", (event) => {
        event.stopPropagation();
        if (collapsedSearchFiles.has(hit.path)) collapsedSearchFiles.delete(hit.path);
        else collapsedSearchFiles.add(hit.path);
        renderSearchResults();
      });

      group.append(header);

      if (!collapsed) {
        const body = document.createElement("div");
        body.className = "inimark-sidebar-search-body";

        if (hit.matches.length === 0 && hit.nameMatch) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "inimark-sidebar-search-snippet";
          row.addEventListener("click", () =>
            void handlers.fileSelect(hit.path, { query: q }),
          );
          const text = document.createElement("span");
          text.className = "inimark-sidebar-search-snippet-text";
          text.textContent = "Filename match";
          row.append(text);
          body.append(row);
        }

        for (const match of hit.matches) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "inimark-sidebar-search-snippet";
          row.addEventListener("click", () =>
            void handlers.fileSelect(hit.path, {
              line: match.line,
              query: q,
              snippet: match.content,
            }),
          );

          const text = document.createElement("span");
          text.className = "inimark-sidebar-search-snippet-text";
          text.append(highlightMatch(match.content, q));
          row.append(text);
          body.append(row);
        }

        group.append(body);
      }

      list.append(group);
    }

    searchResults.append(list);
  }

  function applyWorkspace(workspace: Workspace | null): void {
    if (!workspace) {
      currentTree = [];
      currentWorkspace = null;
      activePath = null;
      activeLibraryId = null;
      workspacePath = "";
      libraryLabel.textContent = "No library";
      expanded.clear();
      cancelSearch();
      clearSearchUi();
      renderEmptyHint("No folder selected");
      renderLibraryList();
      return;
    }

    currentWorkspace = workspace;
    currentTree = workspace.tree;
    workspacePath = workspace.rootPath;
    libraryLabel.textContent = workspace.rootName;
    rerender();
    renderLibraryList();
    if (activePanel === "search") scheduleSearch();
  }

  setActivePanel(activePanel);

  return {
    setWorkspace: applyWorkspace,
    setActiveFile(path) {
      activePath = path;
      rerender();
      if (activePanel === "search" && searchQuery.trim()) renderSearchResults();
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
    setSidebarOpen(open) {
      collapseBtn.innerHTML = sidebarToggleIcon(open);
    },
    onToggleSidebar(handler) {
      handlers.toggleSidebar = handler;
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
      cancelSearch();
      searchField.destroy();
      menu.destroy();
      host.replaceChildren();
    },
  };
}
