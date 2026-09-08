import {
  cloneWorkspaceTreeNode,
  createDirectoryTreeNode,
  createFileTreeNode,
  insertWorkspaceTreeNode,
  moveWorkspaceTreeNodeInMemory,
  removeWorkspaceTreeNode,
} from "./platform/workspace-tree.ts";
import { onLocaleChange, t } from "./i18n/index.ts";
import {
  collapseAllIcon,
  createIconButton,
  createMenu,
  createPanelToolbar,
  createSearchField,
  createTreeBranch,
  createTreeChildren,
  createTreeHost,
  createTreeItem,
  expandAllIcon,
  libraryIcon,
  locateFileIcon,
  menuIcons,
  newFileIcon,
  newFolderIcon,
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
  copyWorkspaceEntry,
  deleteWorkspaceEntry,
  moveWorkspaceEntry,
  openWorkspaceEntryWithDefaultApp,
  renameWorkspaceEntry,
  revealWorkspaceEntry,
} from "./platform/workspace.ts";
import { promptConfirm } from "./ui/confirm-dialog.ts";
import { promptPickFolder } from "./ui/folder-picker-dialog.ts";
import {
  highlightMatch,
  searchVaultIncremental,
  type VaultSearchResult,
} from "./sidebar/vault-search.ts";
import { createBookmarksPanel } from "./sidebar/bookmarks-panel.ts";
import { promptAddBookmark } from "./ui/bookmark-dialog.ts";
import {
  DEFAULT_BOOKMARK_GROUP_ID,
  addBookmark,
  deleteBookmarkGroup,
  isBookmarked,
  remapBookmarkPath,
  removeBookmark,
  removeBookmarksUnder,
  type BookmarkItem,
} from "./bookmarks/store.ts";
import { libraryIdFromPath } from "./libraries/store.ts";
import {
  DEFAULT_LEFT_SIDEBAR_TABS,
  sidebarTabIcon,
  sidebarTabLabel,
  type SidebarTabId,
} from "./sidebar/tab-layout.ts";
import { loadSettings } from "./settings/store.ts";

export type SidebarPanelId = SidebarTabId;

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

function sortLabel(mode: FilesSortMode): string {
  const option = FILES_SORT_OPTIONS.find((opt) => opt.mode === mode);
  return option ? t(option.labelKey) : t("sidebar.toolbar.sort");
}

export type FileSelectOptions = {
  line?: number;
  query?: string;
  snippet?: string;
};

export type PathRenamePair = { from: string; to: string };

export interface SidebarController {
  setWorkspace(workspace: Workspace | null): void;
  setActiveFile(path: string | null): void;
  setSavedLibraries(libraries: LibraryRecord[], activeLibraryId: string | null): void;
  setExpandedDirs(dirs: string[]): void;
  getExpandedDirs(): string[];
  setSidebarOpen(open: boolean): void;
  getPanels(): Partial<Record<SidebarTabId, HTMLElement>>;
  setTabs(ids: SidebarTabId[], panels: Partial<Record<SidebarTabId, HTMLElement>>): void;
  activatePanel(id: SidebarTabId): void;
  hasTab(id: SidebarTabId): boolean;
  notifyPanelShown(id: SidebarTabId): void;
  cutSelection(): void;
  copySelection(): void;
  pasteClipboard(): Promise<void>;
  renameSelection(): void;
  deleteSelection(): Promise<void>;
  /** True when explorer shortcuts should run (selection + recent tree interaction). */
  isTreeShortcutContext(): boolean;
  onToggleSidebar(handler: () => void): void;
  onFileSelect(handler: (path: string, options?: FileSelectOptions) => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  onOpenSettings(handler: () => void): void;
  onCloseLibrary(handler: () => void): void;
  onSwitchLibrary(handler: (libraryId: string) => void | Promise<void>): void;
  onExpandedDirsChange(handler: (dirs: string[]) => void): void;
  /** Fired after files/folders are renamed or moved (all descendant note pairs). */
  onEntriesMoved(handler: (pairs: PathRenamePair[]) => void | Promise<void>): void;
  onFileDeleted(handler: (path: string) => void): void;
  destroy(): void;
}

type FileClipboard = {
  mode: "cut" | "copy";
  paths: string[];
  rootPath: string;
};

function loadActivePanel(available: SidebarTabId[]): SidebarTabId {
  try {
    const saved = localStorage.getItem(SIDEBAR_PANEL_KEY);
    if (saved && available.includes(saved as SidebarTabId)) {
      return saved as SidebarTabId;
    }
  } catch {
    /* ignore */
  }
  return available[0] ?? "files";
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

function findTreeNode(
  nodes: WorkspaceTreeNode[],
  path: string,
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children?.length) {
      const found = findTreeNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function collectFilesUnder(node: WorkspaceTreeNode): string[] {
  if (node.kind === "file") return [node.path];
  const out: string[] = [];
  for (const child of node.children ?? []) {
    out.push(...collectFilesUnder(child));
  }
  return out;
}

/** Build note path pairs for a moved/renamed entry (folder → all descendant notes). */
function buildRenamePairs(
  fromPath: string,
  toPath: string,
  node: WorkspaceTreeNode,
): PathRenamePair[] {
  if (node.kind === "file") return [{ from: fromPath, to: toPath }];
  return collectFilesUnder(node).map((filePath) => ({
    from: filePath,
    to: `${toPath}${filePath.slice(fromPath.length)}`,
  }));
}

/** Prefer top-level paths when both a parent and its child are selected. */
function topLevelPaths(paths: Iterable<string>): string[] {
  const sorted = [...paths].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const result: string[] = [];
  for (const path of sorted) {
    if (result.some((parent) => path === parent || path.startsWith(`${parent}/`))) {
      continue;
    }
    result.push(path);
  }
  return result;
}

function isModClick(event: MouseEvent): boolean {
  return detectPlatform() === "macos" ? event.metaKey : event.ctrlKey;
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

  let tabIds: SidebarTabId[] = (() => {
    const settings = loadSettings();
    return settings.leftSidebarTabs.length > 0
      ? [...settings.leftSidebarTabs]
      : [...DEFAULT_LEFT_SIDEBAR_TABS];
  })();
  const tabButtons = new Map<SidebarTabId, HTMLButtonElement>();
  let panelElements: Partial<Record<SidebarTabId, HTMLElement>> = {};

  function rebuildTabButtons(): void {
    tabs.replaceChildren();
    tabButtons.clear();
    for (const id of tabIds) {
      const label = sidebarTabLabel(id);
      const btn = createIconButton({
        label,
        title: label,
      });
      btn.className = "inimark-sidebar-tab";
      btn.setAttribute("role", "tab");
      btn.dataset.panel = id;
      btn.innerHTML = sidebarTabIcon(id);
      markNoDrag(btn);
      btn.addEventListener("click", () => setActivePanel(id));
      tabButtons.set(id, btn);
      tabs.append(btn);
    }
  }

  rebuildTabButtons();

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
  markNoDrag(treeHost);

  let filesSortMode = loadFilesSortMode();

  const filesToolbar = createPanelToolbar([
    {
      label: t("sidebar.toolbar.newFile"),
      title: t("sidebar.toolbar.newFile"),
      icon: newFileIcon,
      onClick() {
        void createNewFile(getCreateTargetDirectory());
      },
    },
    {
      label: t("sidebar.toolbar.newFolder"),
      title: t("sidebar.toolbar.newFolder"),
      icon: newFolderIcon,
      onClick() {
        void createNewFolder(getCreateTargetDirectory());
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
        toggleCollapseExpandFolders();
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
  searchResults.className = "inimark-sidebar-search-results inimark-scrollbar";
  searchPanel.append(searchToolbar.el, searchField.el, searchMeta, searchResults);

  const bookmarksPanel = document.createElement("div");
  bookmarksPanel.className = "inimark-sidebar-panel";
  bookmarksPanel.dataset.panel = "bookmarks";
  bookmarksPanel.setAttribute("role", "tabpanel");
  bookmarksPanel.hidden = true;

  const bookmarksToolbar = createPanelToolbar([]);
  bookmarksToolbar.setHidden(true);

  const bookmarksList = createBookmarksPanel({
    onOpenItem(item) {
      openBookmarkItem(item);
    },
    onItemContextMenu(event, item) {
      openBookmarkItemContextMenu(event, item);
    },
    onGroupContextMenu(event, groupId) {
      openBookmarkGroupContextMenu(event, groupId);
    },
  });
  bookmarksPanel.append(bookmarksToolbar.el, bookmarksList.el);

  body.append(filesPanel, searchPanel, bookmarksPanel);
  panelElements = {
    files: filesPanel,
    search: searchPanel,
    bookmarks: bookmarksPanel,
  };

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
  let currentWorkspace: Workspace | null = null;
  let activePanel: SidebarPanelId = loadActivePanel(tabIds);
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
    entriesMoved: (_pairs: PathRenamePair[]): void | Promise<void> => {},
    fileDeleted: (_path: string): void => {},
  };

  const selectedPaths = new Set<string>();
  let selectionAnchor: string | null = null;
  let fileClipboard: FileClipboard | null = null;
  /** Keeps explorer shortcuts alive after rerender destroys focused tree rows. */
  let treeShortcutArmed = false;
  /** Pointer DnD (HTML5 drag is unreliable in Tauri/WKWebView). */
  let dropTargetPath: string | null = null;
  let suppressTreeClick = false;
  let treePointerDrag: {
    pointerId: number;
    paths: string[];
    ghost: HTMLElement;
    offsetX: number;
    offsetY: number;
    active: boolean;
    startX: number;
    startY: number;
  } | null = null;
  const TREE_DRAG_THRESHOLD_PX = 5;

  function notifyExpandedChange(): void {
    handlers.expandedDirsChange([...expanded]);
    syncCollapseExpandButton();
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
    menu.setPath("");

    if (savedLibraries.length === 0) {
      menu.setEmpty(t("sidebar.library.noneSaved"));
    } else {
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
      return;
    }
    if (
      event.key === "Escape" &&
      fileClipboard?.mode === "cut" &&
      !event.defaultPrevented
    ) {
      const active = document.activeElement;
      const inTree =
        active instanceof Element &&
        Boolean(
          active.closest('.inimark-sidebar-panel[data-panel="files"] .inimark-tree'),
        );
      if (inTree) {
        clearFileClipboard();
      }
    }
  });

  treeHost.addEventListener("contextmenu", (event) => {
    // Suppress native menu on empty tree chrome.
    if (event.target === treeHost) event.preventDefault();
  });

  treeHost.addEventListener("pointerdown", () => {
    treeShortcutArmed = true;
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (treeHost.contains(target)) {
      treeShortcutArmed = true;
      return;
    }
    // Rename input lives in the tree; keep context while editing the name.
    if (
      target instanceof HTMLElement &&
      target.classList.contains("inimark-tree-rename")
    ) {
      treeShortcutArmed = true;
      return;
    }
    if (!filesPanel.contains(target)) {
      treeShortcutArmed = false;
    }
  });

  function resolveDropDirectoryAt(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY);
    if (!hit) return null;
    if (!treeHost.contains(hit) && hit !== treeHost) return null;

    const el = hit.closest?.(".inimark-tree-item") as HTMLElement | null;
    if (el && treeHost.contains(el)) {
      if (el.dataset.kind === "directory") return el.dataset.path ?? "";
      return parentRelativePath(el.dataset.path ?? "");
    }

    // Row gaps / indent guides sit between items — keep the last target so the
    // highlight doesn't flicker to "vault root". Only the tree's empty chrome
    // (padding below the list) should mean root.
    if (hit !== treeHost && dropTargetPath != null) return dropTargetPath;
    return "";
  }

  function endTreePointerDrag(commit: boolean, clientX?: number, clientY?: number): void {
    const drag = treePointerDrag;
    if (!drag) return;
    const paths = drag.paths;
    const wasActive = drag.active;
    drag.ghost.remove();
    treePointerDrag = null;
    treeHost.classList.remove("is-dnd", "is-drop-root");
    document.documentElement.classList.remove("is-pointer-dnd");
    treeHost
      .querySelectorAll(".is-dragging, .is-drop-target")
      .forEach((el) => el.classList.remove("is-dragging", "is-drop-target"));
    const dest =
      commit && wasActive && clientX != null && clientY != null
        ? resolveDropDirectoryAt(clientX, clientY)
        : null;
    setDropTarget(null);
    if (wasActive) {
      suppressTreeClick = true;
      // Clear even if the synthetic click never arrives.
      setTimeout(() => {
        suppressTreeClick = false;
      }, 0);
    }
    if (!commit || !wasActive || dest == null || paths.length === 0) return;
    if (!canDropOn(dest, paths)) return;
    void moveNodesToDirectory(paths, dest);
  }

  function activateTreePointerDrag(): void {
    const drag = treePointerDrag;
    if (!drag || drag.active) return;
    drag.active = true;
    treeHost.classList.add("is-dnd");
    document.documentElement.classList.add("is-pointer-dnd");
    window.getSelection()?.removeAllRanges();
    document.body.append(drag.ghost);
    for (const path of drag.paths) {
      treeHost
        .querySelector(`[data-path="${CSS.escape(path)}"]`)
        ?.classList.add("is-dragging");
    }
    drag.ghost.style.left = `${drag.startX - drag.offsetX}px`;
    drag.ghost.style.top = `${drag.startY - drag.offsetY}px`;
  }

  treeHost.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.shiftKey || isModClick(event)) return;
    if (treePointerDrag) return;
    const row = (event.target as Element | null)?.closest?.(
      ".inimark-tree-item.is-draggable",
    ) as HTMLElement | null;
    if (!row || !treeHost.contains(row)) return;
    const path = row.dataset.path;
    if (!path) return;
    const node = findTreeNode(currentTree, path);
    if (!node) return;

    if (!selectedPaths.has(path)) {
      setSelection([path], path);
      treeHost
        .querySelectorAll(".inimark-tree-item.is-selected")
        .forEach((el) => el.classList.remove("is-selected"));
      row.classList.add("is-selected");
    }

    const paths = topLevelPaths(selectedPaths);
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true) as HTMLElement;
    ghost.classList.add("inimark-tree-drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.position = "fixed";
    ghost.style.zIndex = "10000";
    ghost.style.pointerEvents = "none";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    if (paths.length > 1) {
      const badge = document.createElement("span");
      badge.className = "inimark-tree-drag-count";
      badge.textContent = String(paths.length);
      ghost.append(badge);
    }

    treePointerDrag = {
      pointerId: event.pointerId,
      paths,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      active: false,
      startX: event.clientX,
      startY: event.clientY,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!treePointerDrag || moveEvent.pointerId !== treePointerDrag.pointerId) return;
      const dx = moveEvent.clientX - treePointerDrag.startX;
      const dy = moveEvent.clientY - treePointerDrag.startY;
      if (!treePointerDrag.active) {
        if (dx * dx + dy * dy < TREE_DRAG_THRESHOLD_PX * TREE_DRAG_THRESHOLD_PX) {
          return;
        }
        activateTreePointerDrag();
      }
      moveEvent.preventDefault();
      window.getSelection()?.removeAllRanges();
      treePointerDrag.ghost.style.left = `${moveEvent.clientX - treePointerDrag.offsetX}px`;
      treePointerDrag.ghost.style.top = `${moveEvent.clientY - treePointerDrag.offsetY}px`;
      const dest = resolveDropDirectoryAt(moveEvent.clientX, moveEvent.clientY);
      if (dest == null || !canDropOn(dest, treePointerDrag.paths)) {
        setDropTarget(null);
        return;
      }
      setDropTarget(dest);
    };

    const onUp = (upEvent: PointerEvent) => {
      if (!treePointerDrag || upEvent.pointerId !== treePointerDrag.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      endTreePointerDrag(true, upEvent.clientX, upEvent.clientY);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  function handlePanelShown(panel: SidebarTabId): void {
    if (panel === "search") {
      queueMicrotask(() => searchField.focus());
      scheduleSearch();
    }
    if (panel === "bookmarks") {
      refreshBookmarksPanel();
    }
  }

  function setActivePanel(panel: SidebarPanelId): void {
    if (tabIds.length === 0) return;
    if (!tabIds.includes(panel)) panel = tabIds[0]!;
    if (panel !== "files") treeShortcutArmed = false;
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

    for (const id of tabIds) {
      const el = panelElements[id];
      if (el) el.hidden = id !== panel;
    }

    handlePanelShown(panel);
  }

  /** Hide trailing tabs that would collide with the collapse control. */
  function updateTabVisibility(): void {
    const order = tabIds;
    for (const id of order) {
      const btn = tabButtons.get(id);
      if (btn) btn.hidden = false;
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
      const btn = tabButtons.get(order[i]!)!;
      const need = (used > 0 ? tabGap : 0) + btn.getBoundingClientRect().width;
      if (used + need <= available + 0.5) {
        used += need;
        continue;
      }
      for (let j = i; j < order.length; j++) {
        tabButtons.get(order[j]!)!.hidden = true;
      }
      break;
    }
  }

  function applyTabs(
    ids: SidebarTabId[],
    panels: Partial<Record<SidebarTabId, HTMLElement>>,
  ): void {
    tabIds = [...ids];
    panelElements = { ...panels };
    rebuildTabButtons();
    body.replaceChildren();
    for (const id of tabIds) {
      const el = panelElements[id];
      if (el) body.append(el);
    }
    if (tabIds.length === 0) {
      activePanel = "files";
      queueMicrotask(() => updateTabVisibility());
      return;
    }
    if (!tabIds.includes(activePanel)) {
      activePanel = loadActivePanel(tabIds);
    }
    setActivePanel(activePanel);
    queueMicrotask(() => updateTabVisibility());
  }

  const tabVisibilityObserver = new ResizeObserver(() => {
    updateTabVisibility();
  });
  tabVisibilityObserver.observe(topbar);
  document.addEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);

  function flattenVisibleNodes(
    nodes: WorkspaceTreeNode[],
    out: WorkspaceTreeNode[] = [],
  ): WorkspaceTreeNode[] {
    for (const node of sortTreeNodes(nodes, filesSortMode)) {
      out.push(node);
      if (
        node.kind === "directory" &&
        expanded.has(node.path) &&
        node.children?.length
      ) {
        flattenVisibleNodes(node.children, out);
      }
    }
    return out;
  }

  function clearSelection(): void {
    selectedPaths.clear();
    selectionAnchor = null;
  }

  function setSelection(paths: string[], anchor?: string | null): void {
    selectedPaths.clear();
    for (const path of paths) selectedPaths.add(path);
    selectionAnchor = anchor === undefined ? (paths[0] ?? null) : anchor;
  }

  function selectRange(toPath: string): void {
    const visible = flattenVisibleNodes(currentTree);
    const anchor = selectionAnchor ?? toPath;
    const fromIdx = visible.findIndex((n) => n.path === anchor);
    const toIdx = visible.findIndex((n) => n.path === toPath);
    if (fromIdx < 0 || toIdx < 0) {
      setSelection([toPath], toPath);
      return;
    }
    const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    selectedPaths.clear();
    for (let i = start; i <= end; i++) selectedPaths.add(visible[i]!.path);
    selectionAnchor = anchor;
  }

  function handleTreeClick(event: MouseEvent, node: WorkspaceTreeNode): void {
    if (suppressTreeClick) {
      suppressTreeClick = false;
      return;
    }
    if (event.shiftKey) {
      selectRange(node.path);
      rerender();
      return;
    }
    if (isModClick(event)) {
      if (selectedPaths.has(node.path)) selectedPaths.delete(node.path);
      else selectedPaths.add(node.path);
      selectionAnchor = node.path;
      rerender();
      return;
    }

    if (node.kind === "directory") {
      setSelection([node.path], node.path);
      if (expanded.has(node.path)) expanded.delete(node.path);
      else expanded.add(node.path);
      notifyExpandedChange();
      rerender();
      return;
    }

    setSelection([node.path], node.path);
    rerender();
    void handlers.fileSelect(node.path);
    queueMicrotask(() => {
      if (treeShortcutArmed) focusSelectedTreeRow();
    });
  }

  function prepareContextSelection(node: WorkspaceTreeNode): void {
    if (!selectedPaths.has(node.path)) {
      setSelection([node.path], node.path);
      rerender();
    }
  }

  function setDropTarget(path: string | null): void {
    if (dropTargetPath === path) return;
    if (dropTargetPath != null && dropTargetPath !== "") {
      treeHost
        .querySelector(`[data-path="${CSS.escape(dropTargetPath)}"]`)
        ?.classList.remove("is-drop-target");
    }
    if (dropTargetPath === "") {
      treeHost.classList.remove("is-drop-root");
    }
    dropTargetPath = path;
    if (path === "") {
      treeHost.classList.add("is-drop-root");
    } else if (path) {
      treeHost
        .querySelector(`[data-path="${CSS.escape(path)}"]`)
        ?.classList.add("is-drop-target");
    }
  }

  function isForbiddenDestForSource(destDir: string, source: string): boolean {
    if (source === destDir) return true;
    return destDir.startsWith(`${source}/`);
  }

  function canDropOn(destDir: string, sources: string[]): boolean {
    return sources.some(
      (source) =>
        !isForbiddenDestForSource(destDir, source) &&
        parentRelativePath(source) !== destDir,
    );
  }

  function renderTree(nodes: WorkspaceTreeNode[], depth = 0): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      const branch = createTreeBranch();
      const selected = selectedPaths.has(node.path);
      const isDropTarget = dropTargetPath === node.path;
      const isCut =
        fileClipboard?.mode === "cut" &&
        fileClipboard.paths.some(
          (path) => node.path === path || node.path.startsWith(`${path}/`),
        );

      if (node.kind === "directory") {
        const isOpen = expanded.has(node.path);
        const row = createTreeItem({
          kind: "directory",
          label: node.name,
          path: node.path,
          depth,
          expanded: isOpen,
          selected,
          draggable: true,
          onClick(event) {
            handleTreeClick(event, node);
          },
          onContextMenu(event) {
            prepareContextSelection(node);
            openTreeContextMenu(event, node);
          },
        });
        if (isDropTarget) row.classList.add("is-drop-target");
        if (isCut) row.classList.add("is-cut");
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
        selected,
        draggable: true,
        onClick(event) {
          handleTreeClick(event, node);
        },
        onContextMenu(event) {
          prepareContextSelection(node);
          openTreeContextMenu(event, node);
        },
      });
      if (isCut) row.classList.add("is-cut");
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
    syncCollapseExpandButton();
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

  function collectDirectoryPaths(
    nodes: WorkspaceTreeNode[],
    out: string[] = [],
  ): string[] {
    for (const node of nodes) {
      if (node.kind !== "directory") continue;
      out.push(node.path);
      if (node.children?.length) collectDirectoryPaths(node.children, out);
    }
    return out;
  }

  function syncCollapseExpandButton(): void {
    const anyExpanded = expanded.size > 0;
    const label = anyExpanded
      ? t("sidebar.toolbar.collapseAll")
      : t("sidebar.toolbar.expandAll");
    collapseAllBtn.title = label;
    collapseAllBtn.setAttribute("aria-label", label);
    collapseAllBtn.innerHTML = anyExpanded ? collapseAllIcon() : expandAllIcon();
  }

  function expandAllFolders(): void {
    const dirs = collectDirectoryPaths(currentTree);
    if (dirs.length === 0) return;
    for (const path of dirs) expanded.add(path);
    notifyExpandedChange();
    rerender();
  }

  function collapseAllFolders(): void {
    if (expanded.size === 0) return;
    expanded.clear();
    notifyExpandedChange();
    rerender();
  }

  function toggleCollapseExpandFolders(): void {
    if (expanded.size > 0) collapseAllFolders();
    else expandAllFolders();
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

  function commitLocalTreeChange(): void {
    if (currentWorkspace) currentTree = currentWorkspace.tree;
    rerender();
  }

  function getSiblingNodes(parentDir: string): WorkspaceTreeNode[] {
    if (!parentDir) return currentTree;
    const parent = findTreeNode(currentTree, parentDir);
    return parent?.children ?? [];
  }

  function getCreateTargetDirectory(): string {
    const paths = topLevelPaths(selectedPaths);
    if (paths.length !== 1) return "";
    const path = paths[0]!;
    const node = findTreeNode(currentTree, path);
    if (node?.kind === "directory") return path;
    return parentRelativePath(path);
  }

  function getPasteTargetDirectory(): string {
    const focus =
      selectionAnchor && selectedPaths.has(selectionAnchor)
        ? selectionAnchor
        : topLevelPaths(selectedPaths)[0];
    if (!focus) return "";
    const node = findTreeNode(currentTree, focus);
    if (node?.kind === "directory") return focus;
    return parentRelativePath(focus);
  }

  function clearFileClipboard(): void {
    if (!fileClipboard) return;
    fileClipboard = null;
    rerender();
  }

  function setFileClipboard(mode: "cut" | "copy"): void {
    if (!currentWorkspace) return;
    const paths = topLevelPaths(selectedPaths);
    if (paths.length === 0) return;
    fileClipboard = {
      mode,
      paths,
      rootPath: currentWorkspace.rootPath,
    };
    rerender();
  }

  function cutSelection(): void {
    setFileClipboard("cut");
  }

  function copySelection(): void {
    setFileClipboard("copy");
  }

  function renameSelection(): void {
    const paths = topLevelPaths(selectedPaths);
    if (paths.length !== 1) return;
    const node = findTreeNode(currentTree, paths[0]!);
    if (node) startInlineRename(node);
  }

  function isTreeShortcutContext(): boolean {
    return (
      treeShortcutArmed &&
      activePanel === "files" &&
      selectedPaths.size > 0 &&
      Boolean(currentWorkspace)
    );
  }

  function focusSelectedTreeRow(): void {
    const focusPath = selectionAnchor ?? topLevelPaths(selectedPaths)[0];
    if (!focusPath) return;
    const row = treeHost.querySelector<HTMLElement>(
      `[data-path="${CSS.escape(focusPath)}"]`,
    );
    row?.focus({ preventScroll: true });
  }

  async function copyNodesToDirectory(
    sourcePaths: string[],
    destDir: string,
  ): Promise<void> {
    if (!currentWorkspace) return;
    const sources = topLevelPaths(sourcePaths).filter(
      (path) => !isForbiddenDestForSource(destDir, path),
    );
    if (sources.length === 0) return;

    const copiedPaths: string[] = [];
    for (const fromPath of sources) {
      const node = findTreeNode(currentTree, fromPath);
      if (!node) continue;
      const result = await copyWorkspaceEntry(currentWorkspace, fromPath, destDir);
      if (result.status === "error") {
        console.error(result.message);
        continue;
      }
      const parent = parentRelativePath(result.path);
      const cloned = cloneWorkspaceTreeNode(node, fromPath, result.path);
      insertWorkspaceTreeNode(currentWorkspace.tree, parent, cloned);
      copiedPaths.push(result.path);
    }

    if (destDir) expandAncestors(`${destDir}/x`);
    notifyExpandedChange();
    if (copiedPaths.length > 0) setSelection(copiedPaths, copiedPaths[0] ?? null);
    commitLocalTreeChange();
  }

  async function pasteClipboard(): Promise<void> {
    if (!currentWorkspace || !fileClipboard) return;
    if (fileClipboard.rootPath !== currentWorkspace.rootPath) {
      clearFileClipboard();
      return;
    }
    const sources = fileClipboard.paths.filter((path) =>
      Boolean(findTreeNode(currentTree, path)),
    );
    if (sources.length === 0) {
      clearFileClipboard();
      return;
    }

    const destDir = getPasteTargetDirectory();
    if (fileClipboard.mode === "cut") {
      const movable = sources.filter(
        (path) =>
          !isForbiddenDestForSource(destDir, path) &&
          parentRelativePath(path) !== destDir,
      );
      if (movable.length === 0) return;
      await moveNodesToDirectory(movable, destDir);
      clearFileClipboard();
      return;
    }
    await copyNodesToDirectory(sources, destDir);
  }

  async function removeNodeFromTree(node: WorkspaceTreeNode): Promise<boolean> {
    if (!currentWorkspace) return false;
    const result = await deleteWorkspaceEntry(currentWorkspace, node.path);
    if (result.status === "error") {
      console.error(result.message);
      return false;
    }

    if (node.kind === "directory") {
      for (const path of [...expanded]) {
        if (path === node.path || path.startsWith(`${node.path}/`)) {
          expanded.delete(path);
        }
      }
    }

    const deletedActive =
      activePath === node.path ||
      (node.kind === "directory" && Boolean(activePath?.startsWith(`${node.path}/`)));

    const libraryId = currentLibraryId();
    if (libraryId) {
      if (node.kind === "directory") removeBookmarksUnder(libraryId, node.path);
      else removeBookmark(libraryId, node.path);
    }

    selectedPaths.delete(node.path);
    if (selectionAnchor === node.path) selectionAnchor = null;

    if (
      fileClipboard?.paths.some(
        (path) => path === node.path || path.startsWith(`${node.path}/`),
      )
    ) {
      fileClipboard = null;
    }

    removeWorkspaceTreeNode(currentWorkspace.tree, node.path);
    if (deletedActive) handlers.fileDeleted(node.path);
    return true;
  }

  async function deleteSelection(): Promise<void> {
    if (!currentWorkspace) return;
    const paths = topLevelPaths(selectedPaths);
    if (paths.length === 0) return;

    if (paths.length === 1) {
      const node = findTreeNode(currentTree, paths[0]!);
      if (node) await deleteNode(node);
      return;
    }

    const confirmed = await promptConfirm({
      title: t("dialogs.deleteManyTitle", { count: paths.length }),
      message: t("dialogs.deleteManyMessage", { count: paths.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      danger: true,
    });
    if (!confirmed) return;

    for (const path of paths) {
      const node = findTreeNode(currentTree, path);
      if (node) await removeNodeFromTree(node);
    }
    notifyExpandedChange();
    commitLocalTreeChange();
    refreshBookmarksPanel();
  }

  async function createNewFile(parentDir: string): Promise<void> {
    if (!currentWorkspace) return;
    const siblingNames = new Set(
      getSiblingNodes(parentDir).map((n) => n.name.toLowerCase()),
    );
    const fileName = uniqueChildName(siblingNames, t("common.untitled"), ".md");
    const relativePath = joinRelativePath(parentDir, fileName);
    const result = await createWorkspaceFile(currentWorkspace, relativePath, "");
    if (result.status === "error") {
      console.error(result.message);
      return;
    }
    if (parentDir) {
      expanded.add(parentDir);
      notifyExpandedChange();
    }
    insertWorkspaceTreeNode(
      currentWorkspace.tree,
      parentDir,
      createFileTreeNode(relativePath),
    );
    commitLocalTreeChange();
    const node = findTreeNode(currentTree, relativePath);
    if (!node) {
      void handlers.fileSelect(relativePath);
      return;
    }
    // Rename before opening — selecting the file focuses the editor and
    // would blur/destroy the inline rename input.
    startInlineRename(node, {
      onDone(path) {
        void handlers.fileSelect(path);
      },
    });
  }

  async function createNewFolder(parentDir: string): Promise<void> {
    if (!currentWorkspace) return;
    const siblingNames = new Set(
      getSiblingNodes(parentDir).map((n) => n.name.toLowerCase()),
    );
    const folderName = uniqueChildName(siblingNames, t("common.newFolder"));
    const relativePath = joinRelativePath(parentDir, folderName);
    const result = await createWorkspaceDirectory(currentWorkspace, relativePath);
    if (result.status === "error") {
      console.error(result.message);
      return;
    }
    if (parentDir) expanded.add(parentDir);
    expanded.add(relativePath);
    notifyExpandedChange();
    insertWorkspaceTreeNode(
      currentWorkspace.tree,
      parentDir,
      createDirectoryTreeNode(relativePath),
    );
    commitLocalTreeChange();
    const node = findTreeNode(currentTree, relativePath);
    if (node) startInlineRename(node);
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

  function currentLibraryId(): string | null {
    if (activeLibraryId) return activeLibraryId;
    if (currentWorkspace) return libraryIdFromPath(currentWorkspace.rootPath);
    return null;
  }

  function refreshBookmarksPanel(): void {
    bookmarksList.render(currentLibraryId(), activePath);
  }

  function openBookmarkItem(item: BookmarkItem): void {
    void handlers.fileSelect(item.path);
  }

  async function addNodeBookmark(node: WorkspaceTreeNode): Promise<void> {
    if (node.kind !== "file") return;
    const libraryId = currentLibraryId();
    if (!libraryId) return;
    const result = await promptAddBookmark({
      libraryId,
      path: node.path,
    });
    if (!result.confirmed) return;
    addBookmark(libraryId, {
      path: node.path,
      groupId: result.groupId || DEFAULT_BOOKMARK_GROUP_ID,
    });
    refreshBookmarksPanel();
  }

  function removeNodeBookmark(path: string): void {
    const libraryId = currentLibraryId();
    if (!libraryId) return;
    removeBookmark(libraryId, path);
    refreshBookmarksPanel();
  }

  function openBookmarkItemContextMenu(
    event: MouseEvent,
    item: BookmarkItem,
  ): void {
    closeMenu();
    closeSortMenu();
    contextMenu.clear();
    contextMenu.setPath("");
    contextMenu.addItem({
      label: t("sidebar.bookmarks.open"),
      icon: menuIcons.external,
      onClick() {
        closeContextMenu();
        openBookmarkItem(item);
      },
    });
    contextMenu.addItem({
      label: t("sidebar.bookmarks.revealInFiles"),
      icon: menuIcons.reveal,
      onClick() {
        closeContextMenu();
        const parent = parentRelativePath(item.path);
        if (parent) {
          const parts = parent.split("/").filter(Boolean);
          let acc = "";
          for (const part of parts) {
            acc = acc ? `${acc}/${part}` : part;
            expanded.add(acc);
          }
          notifyExpandedChange();
        }
        if (tabIds.includes("files")) setActivePanel("files");
        rerender();
        requestAnimationFrame(() => {
          const row = treeHost.querySelector<HTMLElement>(
            `[data-path="${CSS.escape(item.path)}"]`,
          );
          row?.scrollIntoView({ block: "center" });
        });
      },
    });
    contextMenu.addDivider();
    contextMenu.addItem({
      label: t("sidebar.bookmarks.remove"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        closeContextMenu();
        removeNodeBookmark(item.path);
      },
    });
    contextMenu.setOpen(true);
    requestAnimationFrame(() =>
      positionContextMenu(event.clientX, event.clientY),
    );
  }

  function openBookmarkGroupContextMenu(
    event: MouseEvent,
    groupId: string,
  ): void {
    if (groupId === DEFAULT_BOOKMARK_GROUP_ID) return;
    const libraryId = currentLibraryId();
    if (!libraryId) return;
    closeMenu();
    closeSortMenu();
    contextMenu.clear();
    contextMenu.setPath("");
    contextMenu.addItem({
      label: t("sidebar.bookmarks.deleteGroup"),
      icon: menuIcons.trash,
      danger: true,
      onClick() {
        closeContextMenu();
        deleteBookmarkGroup(libraryId, groupId);
        refreshBookmarksPanel();
      },
    });
    contextMenu.setOpen(true);
    requestAnimationFrame(() =>
      positionContextMenu(event.clientX, event.clientY),
    );
  }

  function openTreeContextMenu(event: MouseEvent, node: WorkspaceTreeNode): void {
    if (!currentWorkspace) return;
    closeMenu();
    closeSortMenu();

    contextMenu.clear();
    contextMenu.setPath("");
    if (node.kind === "directory") {
      contextMenu.addItem({
        label: t("sidebar.ctx.addFile"),
        icon: newFileIcon(),
        onClick() {
          closeContextMenu();
          void createNewFile(node.path);
        },
      });
      contextMenu.addItem({
        label: t("sidebar.ctx.addFolder"),
        icon: newFolderIcon(),
        onClick() {
          closeContextMenu();
          void createNewFolder(node.path);
        },
      });
      contextMenu.addDivider();
    }
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
    contextMenu.addItem({
      label: t("sidebar.ctx.copyTo"),
      icon: menuIcons.copyTo,
      onClick() {
        closeContextMenu();
        void copyNodeTo(node);
      },
    });
    contextMenu.addItem({
      label: t("sidebar.ctx.moveTo"),
      icon: menuIcons.moveTo,
      onClick() {
        closeContextMenu();
        void moveNodeTo(node);
      },
    });

    const libraryId = currentLibraryId();
    if (node.kind === "file") {
      const bookmarked = libraryId ? isBookmarked(libraryId, node.path) : false;
      contextMenu.addDivider();
      if (bookmarked) {
        contextMenu.addItem({
          label: t("sidebar.ctx.removeBookmark"),
          icon: menuIcons.bookmark,
          onClick() {
            closeContextMenu();
            removeNodeBookmark(node.path);
          },
        });
      } else {
        contextMenu.addItem({
          label: t("sidebar.ctx.addBookmark"),
          icon: menuIcons.bookmark,
          onClick() {
            closeContextMenu();
            void addNodeBookmark(node);
          },
        });
      }
    }

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

  async function pickDestinationFolder(
    node: WorkspaceTreeNode,
    mode: "copy" | "move",
  ): Promise<string | null> {
    if (!currentWorkspace) return null;
    const picked = await promptPickFolder({
      title: mode === "copy" ? t("sidebar.ctx.copyTo") : t("sidebar.ctx.moveTo"),
      confirmLabel: mode === "copy" ? t("sidebar.ctx.copyHere") : t("sidebar.ctx.moveHere"),
      sourcePath: node.path,
      rootLabel: currentWorkspace.rootName || t("sidebar.ctx.vaultRoot"),
      folders: currentTree,
      excludePaths: node.kind === "directory" ? [node.path] : [],
      initialPath: parentRelativePath(node.path),
    });
    if (!picked.confirmed) return null;
    return picked.path;
  }

  async function copyNodeTo(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const destDir = await pickDestinationFolder(node, "copy");
    if (destDir == null) return;

    const result = await copyWorkspaceEntry(currentWorkspace, node.path, destDir);
    if (result.status === "error") {
      console.error(result.message);
      return;
    }

    const parent = parentRelativePath(result.path);
    if (parent) {
      const parts = parent.split("/").filter(Boolean);
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        expanded.add(acc);
      }
      notifyExpandedChange();
    }
    const sourceNode = findTreeNode(currentTree, node.path);
    if (sourceNode) {
      const cloned = cloneWorkspaceTreeNode(sourceNode, node.path, result.path);
      insertWorkspaceTreeNode(currentWorkspace.tree, parent, cloned);
    }
    commitLocalTreeChange();
  }

  async function moveNodeTo(node: WorkspaceTreeNode): Promise<void> {
    if (!currentWorkspace) return;
    const sources = topLevelPaths(
      selectedPaths.has(node.path) ? selectedPaths : [node.path],
    );
    const exclude = sources.filter((path) => {
      const n = findTreeNode(currentTree, path);
      return n?.kind === "directory";
    });
    const picked = await promptPickFolder({
      title: t("sidebar.ctx.moveTo"),
      confirmLabel: t("sidebar.ctx.moveHere"),
      sourcePath: sources.join(", "),
      rootLabel: currentWorkspace.rootName || t("sidebar.ctx.vaultRoot"),
      folders: currentTree,
      excludePaths: exclude,
      initialPath: parentRelativePath(node.path),
    });
    if (!picked.confirmed) return;
    await moveNodesToDirectory(sources, picked.path);
  }

  function expandAncestors(path: string): void {
    const parts = path.split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
      expanded.add(acc);
    }
  }

  function notifyEntriesMoved(pairs: PathRenamePair[]): void {
    if (pairs.length === 0) return;
    void handlers.entriesMoved(pairs);
  }

  async function moveNodesToDirectory(
    sourcePaths: string[],
    destDir: string,
  ): Promise<void> {
    if (!currentWorkspace) return;
    const sources = topLevelPaths(sourcePaths).filter(
      (path) =>
        !isForbiddenDestForSource(destDir, path) &&
        parentRelativePath(path) !== destDir,
    );
    if (sources.length === 0) return;

    const allPairs: PathRenamePair[] = [];
    const movedRoots: PathRenamePair[] = [];
    const libraryId = currentLibraryId();

    for (const fromPath of sources) {
      const node = findTreeNode(currentTree, fromPath);
      if (!node) continue;
      if (parentRelativePath(fromPath) === destDir) continue;

      const result = await moveWorkspaceEntry(currentWorkspace, fromPath, destDir);
      if (result.status === "error") {
        console.error(result.message);
        continue;
      }
      if (result.path === fromPath) continue;

      movedRoots.push({ from: fromPath, to: result.path });
      allPairs.push(...buildRenamePairs(fromPath, result.path, node));

      if (node.kind === "directory") {
        remapExpandedPaths(fromPath, result.path);
      }
      if (libraryId) remapBookmarkPath(libraryId, fromPath, result.path);

      selectedPaths.delete(fromPath);
      selectedPaths.add(result.path);

      if (!moveWorkspaceTreeNodeInMemory(currentWorkspace.tree, fromPath, result.path)) {
        console.error(`Failed to update tree for move: ${fromPath} -> ${result.path}`);
      }
    }

    if (destDir) expandAncestors(`${destDir}/x`);
    notifyExpandedChange();

    if (activePath) {
      for (const { from, to } of movedRoots) {
        if (activePath === from) {
          activePath = to;
          break;
        }
        if (activePath.startsWith(`${from}/`)) {
          activePath = `${to}${activePath.slice(from.length)}`;
          break;
        }
      }
    }

    commitLocalTreeChange();
    refreshBookmarksPanel();
    notifyEntriesMoved(allPairs);
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

    const ok = await removeNodeFromTree(node);
    if (!ok) return;
    notifyExpandedChange();
    commitLocalTreeChange();
    refreshBookmarksPanel();
  }

  function startInlineRename(
    node: WorkspaceTreeNode,
    options?: { onDone?: (path: string) => void },
  ): void {
    const row = treeHost.querySelector<HTMLElement>(
      `[data-path="${CSS.escape(node.path)}"]`,
    );
    const label = row?.querySelector<HTMLElement>(".inimark-tree-label");
    if (!row || !label) {
      options?.onDone?.(node.path);
      return;
    }

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

    function settle(path: string): void {
      options?.onDone?.(path);
    }

    async function commit(): Promise<void> {
      if (finished) return;
      finished = true;
      const nextName = input.value.trim();
      if (!nextName || nextName === node.name) {
        rerender();
        settle(node.path);
        return;
      }
      if (/[/\\]/.test(nextName)) {
        console.error("Name cannot contain path separators");
        rerender();
        settle(node.path);
        return;
      }
      const finalPath = await renameNode(node, nextName);
      settle(finalPath);
    }

    function cancel(): void {
      if (finished) return;
      finished = true;
      rerender();
      settle(node.path);
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

  async function renameNode(node: WorkspaceTreeNode, nextName: string): Promise<string> {
    if (!currentWorkspace) return node.path;
    const parent = parentRelativePath(node.path);
    const toPath = joinRelativePath(parent, nextName);
    if (toPath === node.path) {
      rerender();
      return node.path;
    }

    const result = await renameWorkspaceEntry(currentWorkspace, node.path, toPath);
    if (result.status === "error") {
      console.error(result.message);
      rerender();
      return node.path;
    }

    const pairs = buildRenamePairs(node.path, toPath, node);

    if (node.kind === "directory") {
      remapExpandedPaths(node.path, toPath);
      notifyExpandedChange();
    }

    const libraryId = currentLibraryId();
    if (libraryId) remapBookmarkPath(libraryId, node.path, toPath);

    if (activePath === node.path) activePath = toPath;
    else if (activePath?.startsWith(`${node.path}/`)) {
      activePath = `${toPath}${activePath.slice(node.path.length)}`;
    }

    selectedPaths.delete(node.path);
    selectedPaths.add(toPath);

    if (!moveWorkspaceTreeNodeInMemory(currentWorkspace.tree, node.path, toPath)) {
      console.error(`Failed to update tree for rename: ${node.path} -> ${toPath}`);
    }
    commitLocalTreeChange();
    refreshBookmarksPanel();
    notifyEntriesMoved(pairs);
    return toPath;
  }

  function rerender(): void {
    const keepTreeFocus =
      treeShortcutArmed ||
      treeHost.contains(document.activeElement) ||
      document.activeElement === treeHost;
    const focusPath = selectionAnchor ?? topLevelPaths(selectedPaths)[0] ?? null;

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

    if (keepTreeFocus && focusPath) {
      queueMicrotask(() => {
        if (!treeShortcutArmed && !treeHost.contains(document.activeElement)) {
          return;
        }
        const row = treeHost.querySelector<HTMLElement>(
          `[data-path="${CSS.escape(focusPath)}"]`,
        );
        row?.focus({ preventScroll: true });
      });
    }
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
    clearSelection();
    fileClipboard = null;
    treeShortcutArmed = false;
    if (!workspace) {
      currentTree = [];
      currentWorkspace = null;
      activePath = null;
      activeLibraryId = null;
      libraryLabel.textContent = t("sidebar.noLibrary");
      expanded.clear();
      cancelSearch();
      clearSearchUi();
      renderEmptyHint(t("sidebar.empty.noFolder"));
      renderLibraryList();
      refreshBookmarksPanel();
      updateFilesToolbarState();
      return;
    }

    currentWorkspace = workspace;
    currentTree = workspace.tree;
    libraryLabel.textContent = workspace.rootName;
    rerender();
    renderLibraryList();
    refreshBookmarksPanel();
    updateFilesToolbarState();
    if (activePanel === "search") scheduleSearch();
  }

  setActivePanel(activePanel);
  updateFilesToolbarState();
  queueMicrotask(() => updateTabVisibility());

  function refreshChrome(): void {
    for (const [id, btn] of tabButtons) {
      const label = sidebarTabLabel(id);
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
    updateFilesToolbarState();

    searchField.input.placeholder = t("sidebar.searchPlaceholder");
    searchField.input.setAttribute("aria-label", t("sidebar.searchPlaceholder"));
    refreshBookmarksPanel();
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
      if (activePanel === "bookmarks") refreshBookmarksPanel();
    },
    setSavedLibraries(libraries, activeId) {
      savedLibraries = libraries;
      activeLibraryId = activeId;
      renderLibraryList();
      refreshBookmarksPanel();
    },
    setExpandedDirs(dirs) {
      expanded.clear();
      for (const dir of dirs) expanded.add(dir);
      syncCollapseExpandButton();
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
    getPanels() {
      return {
        files: filesPanel,
        search: searchPanel,
        bookmarks: bookmarksPanel,
      };
    },
    setTabs(ids, panels) {
      applyTabs(ids, panels);
    },
    activatePanel(id) {
      if (!tabIds.includes(id)) return;
      setActivePanel(id);
    },
    hasTab(id) {
      return tabIds.includes(id);
    },
    notifyPanelShown(id) {
      handlePanelShown(id);
    },
    cutSelection,
    copySelection,
    pasteClipboard,
    renameSelection,
    deleteSelection,
    isTreeShortcutContext,
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
    onEntriesMoved(handler) {
      handlers.entriesMoved = handler;
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
      bookmarksList.destroy();
      searchField.destroy();
      contextMenu.destroy();
      sortMenu.destroy();
      menu.destroy();
      host.replaceChildren();
    },
  };
}
