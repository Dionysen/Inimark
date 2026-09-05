import { onLocaleChange, t } from "./i18n/index.ts";
import {
  bookmarksTabIcon,
  collapseAllIcon,
  createIconButton,
  createMenu,
  createPanelToolbar,
  createSearchField,
  createTreeBranch,
  createTreeChildren,
  createTreeHost,
  createTreeItem,
  filesTabIcon,
  libraryIcon,
  locateFileIcon,
  menuIcons,
  newFileIcon,
  newFolderIcon,
  searchTabIcon,
  settingsIcon,
  sidebarToggleIcon,
  sortIcon,
} from "./ui/widgets/index.ts";
import type { LibraryRecord } from "./libraries/store.ts";
import { detectPlatform } from "./platform/platform.ts";
import type { Workspace, WorkspaceTreeNode } from "./platform/types.ts";
import { FULLSCREEN_CHANGE_EVENT } from "./platform/window-chrome.ts";
import { joinWorkspacePath } from "./platform/env.ts";
import {
  createWorkspaceDirectory,
  createWorkspaceFile,
  deleteWorkspaceEntry,
  openWorkspaceEntryWithDefaultApp,
  refreshWorkspaceTree,
  renameWorkspaceEntry,
  revealWorkspaceEntry,
} from "./platform/workspace.ts";
import { promptConfirm } from "./ui/confirm-dialog.ts";
import {
  highlightMatch,
  searchVaultIncremental,
  type VaultSearchResult,
} from "./sidebar/vault-search.ts";

export type SidebarPanelId = "files" | "search" | "bookmarks";

type FilesSortMode =
  | "name-asc"
  | "name-desc"
  | "mtime-desc"
  | "mtime-asc"
  | "birthtime-desc"
  | "birthtime-asc";

const SIDEBAR_PANEL_KEY = "inimark-sidebar-panel";
const FILES_SORT_KEY = "inimark-files-sort";

const FILES_SORT_OPTIONS: Array<{
  mode: FilesSortMode;
  labelKey: string;
}> = [
  { mode: "name-asc", labelKey: "sidebar.sort.nameAsc" },
  { mode: "name-desc", labelKey: "sidebar.sort.nameDesc" },
  { mode: "mtime-desc", labelKey: "sidebar.sort.mtimeDesc" },
  { mode: "mtime-asc", labelKey: "sidebar.sort.mtimeAsc" },
  { mode: "birthtime-desc", labelKey: "sidebar.sort.birthtimeDesc" },
  { mode: "birthtime-asc", labelKey: "sidebar.sort.birthtimeAsc" },
];

const PANEL_ICONS: Record<SidebarPanelId, () => string> = {
  files: filesTabIcon,
  search: searchTabIcon,
  bookmarks: bookmarksTabIcon,
};

function panelLabel(id: SidebarPanelId): string {
  switch (id) {
    case "files":
      return t("sidebar.tabs.files");
    case "search":
      return t("sidebar.tabs.search");
    case "bookmarks":
      return t("sidebar.tabs.bookmarks");
  }
}

function sortLabel(mode: FilesSortMode): string {
  const option = FILES_SORT_OPTIONS.find((opt) => opt.mode === mode);
  return option ? t(option.labelKey) : t("sidebar.toolbar.sort");
}

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
  onFileRenamed(handler: (from: string, to: string) => void): void;
  onFileDeleted(handler: (path: string) => void): void;
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

function loadFilesSortMode(): FilesSortMode {
  try {
    const saved = localStorage.getItem(FILES_SORT_KEY);
    if (FILES_SORT_OPTIONS.some((opt) => opt.mode === saved)) {
      return saved as FilesSortMode;
    }
  } catch {
    /* ignore */
  }
  return "name-asc";
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

function uniqueChildName(
  existing: Set<string>,
  base: string,
  ext = "",
): string {
  const full = `${base}${ext}`;
  if (!existing.has(full.toLowerCase())) return full;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base} ${i}${ext}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}${ext}`;
}

function timeValue(node: WorkspaceTreeNode, field: "mtimeMs" | "birthtimeMs"): number {
  return node[field] ?? 0;
}

function parentRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

function joinRelativePath(parent: string, name: string): string {
  const clean = name.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  return parent ? `${parent.replace(/\\/g, "/")}/${clean}` : clean;
}

function revealInLabel(): string {
  const platform = detectPlatform();
  if (platform === "macos") return t("common.showInFinder");
  if (platform === "windows") return t("common.showInExplorer");
  return t("common.showInFiles");
}

function sortTreeNodes(
  nodes: WorkspaceTreeNode[],
  mode: FilesSortMode,
): WorkspaceTreeNode[] {
  const copy = nodes.map((node) =>
    node.kind === "directory" && node.children
      ? { ...node, children: sortTreeNodes(node.children, mode) }
      : node,
  );
  copy.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    if (mode === "name-asc" || mode === "name-desc") {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return mode === "name-asc" ? cmp : -cmp;
    }
    if (mode === "mtime-asc" || mode === "mtime-desc") {
      const cmp = timeValue(a, "mtimeMs") - timeValue(b, "mtimeMs");
      return mode === "mtime-asc" ? cmp : -cmp;
    }
    const cmp = timeValue(a, "birthtimeMs") - timeValue(b, "birthtimeMs");
    return mode === "birthtime-asc" ? cmp : -cmp;
  });
  return copy;
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
  for (const id of Object.keys(PANEL_ICONS) as SidebarPanelId[]) {
    const label = panelLabel(id);
    const btn = createIconButton({
      label,
      title: label,
    });
    btn.className = "inimark-sidebar-tab";
    btn.setAttribute("role", "tab");
    btn.dataset.panel = id;
    btn.innerHTML = PANEL_ICONS[id]();
    markNoDrag(btn);
    tabButtons.set(id, btn);
    tabs.append(btn);
  }

  const collapseBtn = createIconButton({
    label: t("common.collapseSidebar"),
    title: t("common.collapseSidebar"),
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
  const treeHost = createTreeHost(t("sidebar.treeAria"));

  let filesSortMode = loadFilesSortMode();

  const filesToolbar = createPanelToolbar([
    {
      label: t("sidebar.toolbar.newFile"),
      title: t("sidebar.toolbar.newFile"),
      icon: newFileIcon,
      onClick() {
        void createNewFile();
      },
    },
    {
      label: t("sidebar.toolbar.newFolder"),
      title: t("sidebar.toolbar.newFolder"),
      icon: newFolderIcon,
      onClick() {
        void createNewFolder();
      },
    },
    {
      label: t("sidebar.toolbar.sort"),
      title: t("sidebar.toolbar.sort"),
      icon: sortIcon,
      onClick(event) {
        event.stopPropagation();
        toggleSortMenu();
      },
    },
    {
      label: t("sidebar.toolbar.locateFile"),
      title: t("sidebar.toolbar.locateFile"),
      icon: locateFileIcon,
      onClick() {
        locateActiveFile();
      },
    },
    {
      label: t("sidebar.toolbar.collapseAll"),
      title: t("sidebar.toolbar.collapseAll"),
      icon: collapseAllIcon,
      onClick() {
        collapseAllFolders();
      },
    },
  ]);
  const newFileBtn = filesToolbar.buttons[0]!;
  const newFolderBtn = filesToolbar.buttons[1]!;
  const sortBtn = filesToolbar.buttons[2]!;
  const locateBtn = filesToolbar.buttons[3]!;
  const collapseAllBtn = filesToolbar.buttons[4]!;
  sortBtn.setAttribute("aria-haspopup", "menu");
  sortBtn.setAttribute("aria-expanded", "false");
  filesPanel.append(filesToolbar.el, treeHost);

  const searchPanel = document.createElement("div");
  searchPanel.className = "inimark-sidebar-panel";
  searchPanel.dataset.panel = "search";
  searchPanel.setAttribute("role", "tabpanel");
  searchPanel.hidden = true;

  // Reserved toolbar slot — hidden until search actions exist.
  const searchToolbar = createPanelToolbar([]);
  searchToolbar.setHidden(true);

  const searchField = createSearchField({
    placeholder: t("sidebar.searchPlaceholder"),
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
  searchPanel.append(searchToolbar.el, searchField.el, searchMeta, searchResults);

  const bookmarksPanel = document.createElement("div");
  bookmarksPanel.className = "inimark-sidebar-panel";
  bookmarksPanel.dataset.panel = "bookmarks";
  bookmarksPanel.setAttribute("role", "tabpanel");
  bookmarksPanel.hidden = true;

  const bookmarksToolbar = createPanelToolbar([]);
  bookmarksToolbar.setHidden(true);

  const bookmarksEmpty = document.createElement("p");
  bookmarksEmpty.className = "inimark-sidebar-empty";
  bookmarksEmpty.textContent = t("sidebar.empty.noBookmarks");
  bookmarksPanel.append(bookmarksToolbar.el, bookmarksEmpty);

  body.append(filesPanel, searchPanel, bookmarksPanel);

  function renderEmptyHint(text: string): void {
    treeHost.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "inimark-sidebar-empty";
    hint.textContent = text;
    treeHost.append(hint);
  }

  renderEmptyHint(t("sidebar.empty.noFolder"));

  const dock = document.createElement("div");
  dock.className = "inimark-sidebar-dock";

  const libraryWrap = document.createElement("div");
  libraryWrap.className = "inimark-library-bar-wrap";

  const libraryBar = document.createElement("button");
  libraryBar.type = "button";
  libraryBar.className = "inimark-library-bar";
  libraryBar.setAttribute("aria-haspopup", "menu");
  libraryBar.setAttribute("aria-expanded", "false");
  libraryBar.title = t("sidebar.libraries");
  libraryBar.innerHTML = `${libraryIcon()}<span class="inimark-library-bar-label">${t("sidebar.noLibrary")}</span>`;
  const libraryLabel = libraryBar.querySelector(".inimark-library-bar-label")!;

  const settingsBtn = createIconButton({
    label: t("sidebar.openSettings"),
    title: t("sidebar.openSettings"),
  });
  settingsBtn.classList.add("inimark-library-bar-settings");
  settingsBtn.innerHTML = settingsIcon();

  libraryWrap.append(libraryBar, settingsBtn);
  dock.append(libraryWrap);

  const menu = createMenu();
  dock.append(menu.el);

  const sortMenu = createMenu();
  sortMenu.el.classList.add("inimark-sort-menu");
  sortMenu.setPath("");
  host.append(sortMenu.el);

  const contextMenu = createMenu();
  contextMenu.el.classList.add("inimark-context-menu");
  contextMenu.setPath("");
  host.append(contextMenu.el);

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
    fileRenamed: (_from: string, _to: string): void => {},
    fileDeleted: (_path: string): void => {},
  };

  function notifyExpandedChange(): void {
    handlers.expandedDirsChange([...expanded]);
  }

  function closeMenu(): void {
    menu.setOpen(false);
    libraryBar.setAttribute("aria-expanded", "false");
  }

  function closeSortMenu(): void {
    sortMenu.setOpen(false);
    sortBtn.setAttribute("aria-expanded", "false");
  }

  function closeContextMenu(): void {
    contextMenu.setOpen(false);
  }

  function toggleMenu(): void {
    closeSortMenu();
    closeContextMenu();
    if (menu.isOpen()) {
      closeMenu();
      return;
    }
    renderLibraryList();
    menu.setOpen(true);
    libraryBar.setAttribute("aria-expanded", "true");
  }

  function positionSortMenu(): void {
    const rect = sortBtn.getBoundingClientRect();
    const menuWidth = Math.max(184, sortMenu.el.offsetWidth || 184);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - menuWidth - 8,
    );
    sortMenu.el.style.top = `${rect.bottom + 4}px`;
    sortMenu.el.style.left = `${left}px`;
  }

  function renderSortMenu(): void {
    sortMenu.clear();
    sortMenu.setPath("");
    FILES_SORT_OPTIONS.forEach((option, index) => {
      if (index === 2 || index === 4) sortMenu.addDivider();
      sortMenu.addItem({
        label: t(option.labelKey),
        checked: filesSortMode === option.mode,
        onClick() {
          setFilesSortMode(option.mode);
          closeSortMenu();
        },
      });
    });
  }

  function toggleSortMenu(): void {
    closeMenu();
    closeContextMenu();
    if (sortMenu.isOpen()) {
      closeSortMenu();
      return;
    }
    renderSortMenu();
    sortMenu.setOpen(true);
    sortBtn.setAttribute("aria-expanded", "true");
    // Measure after open so width is available for clamping.
    requestAnimationFrame(() => positionSortMenu());
  }

  function renderLibraryList(): void {
    menu.clear();
    menu.setPath(
      workspacePath || t("sidebar.empty.noFolder"),
      workspacePath || undefined,
    );

    if (savedLibraries.length === 0) {
      menu.setEmpty(t("sidebar.library.noneSaved"));
    } else {
      menu.addHeading(t("sidebar.library.heading"));
      for (const library of savedLibraries) {
        menu.addItem({
          label: library.rootName,
          icon: menuIcons.library,
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
      label: t("sidebar.library.add"),
      icon: menuIcons.folderPlus,
      onClick() {
        closeMenu();
        void handlers.openFolder();
      },
    });
    menu.addItem({
      label: t("sidebar.library.close"),
      icon: menuIcons.close,
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
    const target = event.target as Node | null;
    if (menu.isOpen() && !(target && dock.contains(target))) {
      closeMenu();
    }
    if (
      sortMenu.isOpen() &&
      !(target && (sortMenu.el.contains(target) || sortBtn.contains(target)))
    ) {
      closeSortMenu();
    }
    if (contextMenu.isOpen() && !(target && contextMenu.el.contains(target))) {
      closeContextMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && contextMenu.isOpen()) {
      closeContextMenu();
    }
  });

  treeHost.addEventListener("contextmenu", (event) => {
    // Suppress native menu on empty tree chrome.
    if (event.target === treeHost) event.preventDefault();
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

  /** Hide trailing tabs that would collide with the collapse control. */
  function updateTabVisibility(): void {
    const order = Object.keys(PANEL_ICONS) as SidebarPanelId[];
    for (const id of order) {
      tabButtons.get(id)!.hidden = false;
    }

    const topbarRect = topbar.getBoundingClientRect();
    if (topbarRect.width <= 0) return;

    const styles = getComputedStyle(topbar);
    const padL = parseFloat(styles.paddingLeft) || 0;
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const available = Math.max(
      0,
      collapseBtn.getBoundingClientRect().left - gap - (topbarRect.left + padL),
    );
    const tabGap = 2;

    let used = 0;
    for (let i = 0; i < order.length; i++) {
      const btn = tabButtons.get(order[i])!;
      const need = (used > 0 ? tabGap : 0) + btn.getBoundingClientRect().width;
      if (used + need <= available + 0.5) {
        used += need;
        continue;
      }
      for (let j = i; j < order.length; j++) {
        tabButtons.get(order[j])!.hidden = true;
      }
      break;
    }
  }

  const tabVisibilityObserver = new ResizeObserver(() => {
    updateTabVisibility();
  });
  tabVisibilityObserver.observe(topbar);
  document.addEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);

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
          onContextMenu(event) {
            openTreeContextMenu(event, node);
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
        onContextMenu(event) {
          openTreeContextMenu(event, node);
        },
      });
      branch.append(row);
      frag.append(branch);
    }
    return frag;
  }

  let currentTree: WorkspaceTreeNode[] = [];

  function updateFilesToolbarState(): void {
    const hasWorkspace = Boolean(currentWorkspace);
    filesToolbar.setDisabled(!hasWorkspace);
    // Keep sort available so users can change preference without a library.
    sortBtn.disabled = false;
    sortBtn.title = sortLabel(filesSortMode);
  }

  function setFilesSortMode(mode: FilesSortMode): void {
    if (filesSortMode === mode) return;
    filesSortMode = mode;
    try {
      localStorage.setItem(FILES_SORT_KEY, filesSortMode);
    } catch {
      /* ignore */
    }
    updateFilesToolbarState();
    rerender();
  }

  function collapseAllFolders(): void {
    if (expanded.size === 0) return;
    expanded.clear();
    notifyExpandedChange();
    rerender();
  }

  function locateActiveFile(): void {
    if (!activePath) return;
    const path = activePath;
    const parts = path.split(/[/\\]/).filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
      expanded.add(acc);
    }
    notifyExpandedChange();
    rerender();
    queueMicrotask(() => {
      const row = treeHost.querySelector<HTMLElement>(
        `[data-path="${CSS.escape(path)}"]`,
      );
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  async function refreshTreeFromDisk(): Promise<boolean> {
    if (!currentWorkspace) return false;
    try {
      currentWorkspace.tree = await refreshWorkspaceTree(currentWorkspace);
      currentTree = currentWorkspace.tree;
      rerender();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async function createNewFile(): Promise<void> {
    if (!currentWorkspace) return;
    const rootNames = new Set(
      currentTree.map((n) => n.name.toLowerCase()),
    );
    const fileName = uniqueChildName(rootNames, t("common.untitled"), ".md");
    const result = await createWorkspaceFile(currentWorkspace, fileName, "");
    if (result.status === "error") {
      console.error(result.message);
      return;
    }
    await refreshTreeFromDisk();
    void handlers.fileSelect(fileName);
  }

  async function createNewFolder(): Promise<void> {
    if (!currentWorkspace) return;
    const rootNames = new Set(
      currentTree.map((n) => n.name.toLowerCase()),
    );
    const folderName = uniqueChildName(rootNames, t("common.newFolder"));
    const result = await createWorkspaceDirectory(currentWorkspace, folderName);
    if (result.status === "error") {
      console.error(result.message);
      return;
    }
    expanded.add(folderName);
    notifyExpandedChange();
    await refreshTreeFromDisk();
  }

  function remapExpandedPaths(from: string, to: string): void {
    const next = new Set<string>();
    for (const path of expanded) {
      if (path === from) next.add(to);
      else if (path.startsWith(`${from}/`)) next.add(`${to}${path.slice(from.length)}`);
      else next.add(path);
    }
    expanded.clear();
    for (const path of next) expanded.add(path);
  }

  function positionContextMenu(clientX: number, clientY: number): void {
    const menuWidth = Math.max(180, contextMenu.el.offsetWidth || 180);
    const menuHeight = Math.max(160, contextMenu.el.offsetHeight || 160);
    const left = Math.min(Math.max(8, clientX), window.innerWidth - menuWidth - 8);
    const top = Math.min(Math.max(8, clientY), window.innerHeight - menuHeight - 8);
    contextMenu.el.style.left = `${left}px`;
    contextMenu.el.style.top = `${top}px`;
  }

  function openTreeContextMenu(event: MouseEvent, node: WorkspaceTreeNode): void {
    if (!currentWorkspace) return;
    closeMenu();
    closeSortMenu();

    contextMenu.clear();
    contextMenu.setPath("");
    contextMenu.addItem({
      label: t("sidebar.ctx.rename"),
      icon: menuIcons.rename,
      onClick() {
        closeContextMenu();
        startInlineRename(node);
      },
    });
    contextMenu.addItem({
      label: t("sidebar.ctx.copyPath"),
      icon: menuIcons.copy,
      onClick() {
        closeContextMenu();
        void copyNodePath(node);
      },
    });
    contextMenu.addDivider();
    contextMenu.addItem({
      label: t("common.delete"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        closeContextMenu();
        void deleteNode(node);
      },
    });
    contextMenu.addDivider();
    contextMenu.addItem({
      label: revealInLabel(),
      icon: menuIcons.reveal,
      onClick() {
        closeContextMenu();
        void revealNode(node);
      },
    });
    contextMenu.addItem({
      label: t("sidebar.ctx.openDefault"),
      icon: menuIcons.external,
      onClick() {
        closeContextMenu();
        void openNodeWithDefaultApp(node);
      },
    });

    contextMenu.setOpen(true);
    requestAnimationFrame(() => positionContextMenu(event.clientX, event.clientY));
  }

  async function copyNodePath(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const fullPath = joinWorkspacePath(currentWorkspace.rootPath, node.path);
    try {
      await navigator.clipboard.writeText(fullPath);
    } catch (error) {
      console.error(error);
    }
  }

  async function revealNode(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const result = await revealWorkspaceEntry(currentWorkspace, node.path);
    if (result.status === "error") console.error(result.message);
  }

  async function openNodeWithDefaultApp(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const result = await openWorkspaceEntryWithDefaultApp(currentWorkspace, node.path);
    if (result.status === "error") console.error(result.message);
  }

  async function deleteNode(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const confirmed = await promptConfirm({
      title:
        node.kind === "directory"
          ? t("dialogs.deleteFolderTitle")
          : t("dialogs.deleteFileTitle"),
      message: t("dialogs.deleteMessage", { name: node.name }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;

    const result = await deleteWorkspaceEntry(currentWorkspace, node.path);
    if (result.status === "error") {
      console.error(result.message);
      return;
    }

    if (node.kind === "directory") {
      for (const path of [...expanded]) {
        if (path === node.path || path.startsWith(`${node.path}/`)) {
          expanded.delete(path);
        }
      }
      notifyExpandedChange();
    }

    const deletedActive =
      activePath === node.path ||
      (node.kind === "directory" && Boolean(activePath?.startsWith(`${node.path}/`)));
    await refreshTreeFromDisk();
    if (deletedActive) {
      handlers.fileDeleted(node.path);
    }
  }

  function startInlineRename(node: WorkspaceTreeNode): void {
    const row = treeHost.querySelector<HTMLButtonElement>(
      `[data-path="${CSS.escape(node.path)}"]`,
    );
    const label = row?.querySelector<HTMLElement>(".inimark-tree-label");
    if (!row || !label) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inimark-tree-rename";
    input.value = node.name;
    input.setAttribute("aria-label", `${t("sidebar.ctx.rename")} ${node.name}`);
    label.replaceWith(input);
    input.focus();
    const dot = node.kind === "file" ? node.name.lastIndexOf(".") : -1;
    if (dot > 0) input.setSelectionRange(0, dot);
    else input.select();

    let finished = false;

    async function commit(): Promise<void> {
      if (finished) return;
      finished = true;
      const nextName = input.value.trim();
      if (!nextName || nextName === node.name) {
        rerender();
        return;
      }
      if (/[/\\]/.test(nextName)) {
        console.error("Name cannot contain path separators");
        rerender();
        return;
      }
      await renameNode(node, nextName);
    }

    function cancel(): void {
      if (finished) return;
      finished = true;
      rerender();
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", () => {
      void commit();
    });
  }

  async function renameNode(node: WorkspaceTreeNode, nextName: string): Promise<void> {
    if (!currentWorkspace) return;
    const parent = parentRelativePath(node.path);
    const toPath = joinRelativePath(parent, nextName);
    if (toPath === node.path) {
      rerender();
      return;
    }

    const result = await renameWorkspaceEntry(currentWorkspace, node.path, toPath);
    if (result.status === "error") {
      console.error(result.message);
      rerender();
      return;
    }

    if (node.kind === "directory") {
      remapExpandedPaths(node.path, toPath);
      notifyExpandedChange();
    }

    const wasActive =
      activePath === node.path ||
      (node.kind === "directory" && Boolean(activePath?.startsWith(`${node.path}/`)));
    await refreshTreeFromDisk();

    if (wasActive) {
      if (activePath === node.path) {
        handlers.fileRenamed(node.path, toPath);
      } else if (activePath) {
        const mapped = `${toPath}${activePath.slice(node.path.length)}`;
        handlers.fileRenamed(activePath, mapped);
      }
    }
  }

  function rerender(): void {
    treeHost.replaceChildren();
    if (currentTree.length === 0) {
      renderEmptyHint(
        currentWorkspace
          ? t("sidebar.empty.noMarkdown")
          : t("sidebar.empty.noFolder"),
      );
      return;
    }
    treeHost.append(renderTree(sortTreeNodes(currentTree, filesSortMode)));
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
      countEl.textContent = t("sidebar.searching");
    } else if (searching) {
      countEl.textContent = t("sidebar.resultsMore", { count: matchCount });
    } else {
      countEl.textContent =
        matchCount === 1
          ? t("sidebar.resultsOne")
          : t("sidebar.resultsMany", { count: matchCount });
    }
    searchMeta.append(countEl);

    if (!searching && searchHits.length === 0) {
      const hint = document.createElement("p");
      hint.className = "inimark-sidebar-empty";
      hint.textContent = t("sidebar.empty.noMatches");
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
      if (!collapsed) chevron.classList.add("is-expanded");
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML =
        `<svg viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
          text.textContent = t("sidebar.filenameMatch");
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
    closeContextMenu();
    if (!workspace) {
      currentTree = [];
      currentWorkspace = null;
      activePath = null;
      activeLibraryId = null;
      workspacePath = "";
      libraryLabel.textContent = t("sidebar.noLibrary");
      expanded.clear();
      cancelSearch();
      clearSearchUi();
      renderEmptyHint(t("sidebar.empty.noFolder"));
      renderLibraryList();
      updateFilesToolbarState();
      return;
    }

    currentWorkspace = workspace;
    currentTree = workspace.tree;
    workspacePath = workspace.rootPath;
    libraryLabel.textContent = workspace.rootName;
    rerender();
    renderLibraryList();
    updateFilesToolbarState();
    if (activePanel === "search") scheduleSearch();
  }

  setActivePanel(activePanel);
  updateFilesToolbarState();
  queueMicrotask(() => updateTabVisibility());

  function refreshChrome(): void {
    for (const [id, btn] of tabButtons) {
      const label = panelLabel(id);
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
    collapseBtn.title = t("common.collapseSidebar");
    collapseBtn.setAttribute("aria-label", t("common.collapseSidebar"));

    newFileBtn.title = t("sidebar.toolbar.newFile");
    newFileBtn.setAttribute("aria-label", t("sidebar.toolbar.newFile"));
    newFolderBtn.title = t("sidebar.toolbar.newFolder");
    newFolderBtn.setAttribute("aria-label", t("sidebar.toolbar.newFolder"));
    locateBtn.title = t("sidebar.toolbar.locateFile");
    locateBtn.setAttribute("aria-label", t("sidebar.toolbar.locateFile"));
    collapseAllBtn.title = t("sidebar.toolbar.collapseAll");
    collapseAllBtn.setAttribute("aria-label", t("sidebar.toolbar.collapseAll"));
    updateFilesToolbarState();

    searchField.input.placeholder = t("sidebar.searchPlaceholder");
    searchField.input.setAttribute("aria-label", t("sidebar.searchPlaceholder"));
    bookmarksEmpty.textContent = t("sidebar.empty.noBookmarks");
    libraryBar.title = t("sidebar.libraries");
    settingsBtn.title = t("sidebar.openSettings");
    settingsBtn.setAttribute("aria-label", t("sidebar.openSettings"));
    treeHost.setAttribute("aria-label", t("sidebar.treeAria"));

    if (!currentWorkspace) {
      libraryLabel.textContent = t("sidebar.noLibrary");
      if (currentTree.length === 0) {
        renderEmptyHint(t("sidebar.empty.noFolder"));
      }
    }
    if (menu.isOpen()) renderLibraryList();
    if (sortMenu.isOpen()) renderSortMenu();
    if (activePanel === "search" && searchQuery.trim()) renderSearchResults();
    else if (currentTree.length === 0 && currentWorkspace) {
      renderEmptyHint(t("sidebar.empty.noMarkdown"));
    } else if (currentTree.length > 0) {
      rerender();
    }
  }

  const unsubscribeLocale = onLocaleChange(() => refreshChrome());

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
      const label = open ? t("common.collapseSidebar") : t("common.expandSidebar");
      collapseBtn.title = label;
      collapseBtn.setAttribute("aria-label", label);
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
    onFileRenamed(handler) {
      handlers.fileRenamed = handler;
    },
    onFileDeleted(handler) {
      handlers.fileDeleted = handler;
    },
    destroy() {
      unsubscribeLocale();
      tabVisibilityObserver.disconnect();
      document.removeEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);
      cancelSearch();
      filesToolbar.destroy();
      searchToolbar.destroy();
      bookmarksToolbar.destroy();
      searchField.destroy();
      contextMenu.destroy();
      sortMenu.destroy();
      menu.destroy();
      host.replaceChildren();
    },
  };
}
