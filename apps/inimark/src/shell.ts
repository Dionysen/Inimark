import { onLocaleChange, t } from "./i18n/index.ts";
import { requestOverlayScrollbarRefresh } from "./platform/scrollbars.ts";
import { mountSidebar, type SidebarController } from "./sidebar.ts";
import {
  mountRightSidebar,
  type RightSidebarController,
} from "./right-sidebar.ts";
import {
  attachColumnResize,
  loadPersistedWidth,
  persistWidth,
  type ColumnResizeController,
} from "./ui/column-resize.ts";
import {
  mountTitleBar,
  type TitleBarController,
  type TitleBarExportActions,
  type TitleBarGraphActions,
  type TitleBarImmersiveMenuActions,
  type TitleBarMoreMenuActions,
} from "./ui/titlebar.ts";
import { mountOutlinePanel } from "./sidebar/outline-panel.ts";
import {
  mountGraphPanel,
  type GraphPanelController,
} from "./sidebar/graph-panel.ts";
import {
  mountTagsPanel,
  type TagsPanelController,
} from "./sidebar/tags-panel.ts";
import { mountAiPanel, type AiPanelController } from "./ai/panel.ts";
import { loadSettings, type AppSettings } from "./settings/store.ts";
import type { SidebarTabId } from "./sidebar/tab-layout.ts";

const SIDEBAR_OPEN_KEY = "inimark-sidebar-open";
const SIDEBAR_WIDTH_KEY = "inimark-sidebar-width";
const SIDEBAR_WIDTH_DEFAULT = 240;
const SIDEBAR_WIDTH_MIN = 180;
const SIDEBAR_WIDTH_MAX = 480;

const RIGHT_SIDEBAR_OPEN_KEY = "inimark-right-sidebar-open";
const RIGHT_SIDEBAR_WIDTH_KEY = "inimark-right-sidebar-width";
const RIGHT_SIDEBAR_WIDTH_DEFAULT = 320;
const RIGHT_SIDEBAR_WIDTH_MIN = 180;
const RIGHT_SIDEBAR_WIDTH_MAX = 520;

export interface ShellController {
  editorHost: HTMLElement;
  editorPane: HTMLElement;
  mainColumn: HTMLElement;
  sidebar: SidebarController;
  rightSidebar: RightSidebarController;
  graph: GraphPanelController;
  tags: TagsPanelController;
  ai: AiPanelController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
  toggleSidebar(): void;
  refreshPinnableChrome(): void;
  /** @deprecated Prefer refreshPinnableChrome. */
  refreshGraphChrome(): void;
  toggleRightSidebar(): void;
  focusSearch(): void;
  focusAi(): void;
  applySidebarTabLayout(settings?: AppSettings): void;
  destroy(): void;
}

function loadSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function loadRightSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(RIGHT_SIDEBAR_OPEN_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export interface ShellMountOptions {
  onCloseRequest?: () => void | Promise<void>;
  moreMenuActions?: TitleBarMoreMenuActions;
  immersiveMenuActions?: TitleBarImmersiveMenuActions;
  graphActions?: TitleBarGraphActions;
  exportActions?: TitleBarExportActions;
  onConfigureSidebarTabs?: () => void;
  mountMoreClusterExtras?: (cluster: HTMLElement) => () => void;
}

export function mountShell(
  host: HTMLElement,
  options: ShellMountOptions = {},
): ShellController {
  host.innerHTML = "";
  host.className = "inimark-shell";

  const sidebarHost = document.createElement("aside");
  const sidebar = mountSidebar(sidebarHost);

  const outlinePanelHost = document.createElement("div");
  outlinePanelHost.className = "inimark-sidebar-panel";
  outlinePanelHost.dataset.panel = "outline";
  outlinePanelHost.setAttribute("role", "tabpanel");
  const outline = mountOutlinePanel(outlinePanelHost);

  const graphPanelHost = document.createElement("div");
  graphPanelHost.className = "inimark-sidebar-panel";
  graphPanelHost.dataset.panel = "graph";
  graphPanelHost.setAttribute("role", "tabpanel");
  const graph = mountGraphPanel(graphPanelHost);

  const tagsPanelHost = document.createElement("div");
  tagsPanelHost.className = "inimark-sidebar-panel";
  tagsPanelHost.dataset.panel = "tags";
  tagsPanelHost.setAttribute("role", "tabpanel");
  const tags = mountTagsPanel(tagsPanelHost);

  const aiPanelHost = document.createElement("div");
  const ai = mountAiPanel(aiPanelHost);

  const mainColumn = document.createElement("div");
  mainColumn.className = "inimark-main";

  const rightSidebarHost = document.createElement("aside");
  const rightSidebar = mountRightSidebar(rightSidebarHost, {
    outlinePanel: outlinePanelHost,
    outline,
  });

  function collectPanels(): Partial<Record<SidebarTabId, HTMLElement>> {
    return {
      ...sidebar.getPanels(),
      outline: outlinePanelHost,
      graph: graphPanelHost,
      tags: tagsPanelHost,
      ai: aiPanelHost,
    };
  }

  function applySidebarTabLayout(settings?: AppSettings): void {
    const next = settings ?? loadSettings();
    const panels = collectPanels();
    sidebar.setTabs(next.leftSidebarTabs, panels);
    rightSidebar.setTabs(next.rightSidebarTabs, panels);
    sidebar.applyExplorerSettings(next);
  }

  rightSidebar.onActivateTab((id) => {
    sidebar.notifyPanelShown(id);
  });

  applySidebarTabLayout();

  let sidebarOpen = loadSidebarOpen();
  let sidebarWidth = loadPersistedWidth(
    SIDEBAR_WIDTH_KEY,
    SIDEBAR_WIDTH_DEFAULT,
    SIDEBAR_WIDTH_MIN,
    SIDEBAR_WIDTH_MAX,
  );
  let rightSidebarOpen = loadRightSidebarOpen();
  let rightSidebarWidth = loadPersistedWidth(
    RIGHT_SIDEBAR_WIDTH_KEY,
    RIGHT_SIDEBAR_WIDTH_DEFAULT,
    RIGHT_SIDEBAR_WIDTH_MIN,
    RIGHT_SIDEBAR_WIDTH_MAX,
  );
  let titlebar: TitleBarController;
  let postLayoutTitlebarSync: (() => void) | null = null;

  function applySidebarWidth(): void {
    host.style.setProperty("--inimark-sidebar-width", `${sidebarWidth}px`);
  }

  function applyRightSidebarWidth(): void {
    host.style.setProperty("--inimark-right-sidebar-width", `${rightSidebarWidth}px`);
  }

  function applySidebarState(): void {
    host.classList.toggle("is-sidebar-closed", !sidebarOpen);
    sidebarHost.classList.toggle("is-collapsed", !sidebarOpen);
    titlebar.setSidebarOpen(sidebarOpen);
    sidebar.setSidebarOpen(sidebarOpen);
    requestOverlayScrollbarRefresh();
  }

  function applyRightSidebarState(): void {
    host.classList.toggle("is-right-sidebar-closed", !rightSidebarOpen);
    rightSidebarHost.classList.toggle("is-collapsed", !rightSidebarOpen);
    titlebar.setRightSidebarOpen(rightSidebarOpen);
    rightSidebar.setSidebarOpen(rightSidebarOpen);
    requestOverlayScrollbarRefresh();
    postLayoutTitlebarSync?.();
  }

  function toggleSidebar(): void {
    sidebarOpen = !sidebarOpen;
    localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
    applySidebarState();
  }

  function toggleRightSidebar(): void {
    rightSidebarOpen = !rightSidebarOpen;
    localStorage.setItem(RIGHT_SIDEBAR_OPEN_KEY, rightSidebarOpen ? "1" : "0");
    applyRightSidebarState();
  }

  function ensureSidebarOpen(side: "left" | "right"): void {
    if (side === "left") {
      if (sidebarOpen) return;
      sidebarOpen = true;
      localStorage.setItem(SIDEBAR_OPEN_KEY, "1");
      applySidebarState();
      return;
    }
    if (rightSidebarOpen) return;
    rightSidebarOpen = true;
    localStorage.setItem(RIGHT_SIDEBAR_OPEN_KEY, "1");
    applyRightSidebarState();
  }

  function focusSearch(): void {
    if (sidebar.hasTab("search")) {
      ensureSidebarOpen("left");
      sidebar.activatePanel("search");
      return;
    }
    if (rightSidebar.hasTab("search")) {
      ensureSidebarOpen("right");
      rightSidebar.activatePanel("search");
    }
  }

  function focusAi(): void {
    if (sidebar.hasTab("ai")) {
      ensureSidebarOpen("left");
      sidebar.activatePanel("ai");
      ai.focusComposer();
      return;
    }
    if (rightSidebar.hasTab("ai")) {
      ensureSidebarOpen("right");
      rightSidebar.activatePanel("ai");
      ai.focusComposer();
    }
  }

  const titlebarZone = document.createElement("div");
  titlebarZone.className = "inimark-titlebar-zone";

  const rightSidebarTopbar = rightSidebarHost.querySelector<HTMLElement>(
    ".inimark-right-sidebar-topbar",
  );

  // Sticky reveal class (same idea as statusbar): pure :hover + transform made the
  // bar flash twice when drag-region / fixed Windows chrome briefly stole hit-testing.
  let titlebarHideTimer: ReturnType<typeof setTimeout> | null = null;
  const TITLEBAR_HIDE_DELAY_MS = 120;
  let titlebarMoreCluster: HTMLElement | null = null;
  let rightSidebarTitlebarToggle: HTMLElement | null = null;
  let titlebarHost: HTMLElement | null = null;
  const titlebarRevealTargets: HTMLElement[] = [];
  let pointerX = -1;
  let pointerY = -1;
  let pointerMoveHideTimer: ReturnType<typeof setTimeout> | null = null;

  function onDocumentPointerMove(event: PointerEvent): void {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!isAutoHideTitlebarEnabled() || !titlebarZone.classList.contains("is-revealed")) {
      return;
    }
    if (pointerMoveHideTimer != null) clearTimeout(pointerMoveHideTimer);
    pointerMoveHideTimer = setTimeout(() => {
      pointerMoveHideTimer = null;
      if (!titlebarZone.classList.contains("is-revealed")) return;
      if (pointerOverTitlebarReveal()) return;
      commitHideTitlebarZone();
    }, TITLEBAR_HIDE_DELAY_MS);
  }

  document.addEventListener("pointermove", onDocumentPointerMove, { passive: true });

  function isAutoHideTitlebarEnabled(): boolean {
    return document.documentElement.dataset.autoHideTitlebar === "true";
  }

  function elementUnderPointer(): Element | null {
    if (pointerX < 0 || pointerY < 0) return null;
    return document.elementFromPoint(pointerX, pointerY);
  }

  function isTitlebarRevealElement(el: Element): boolean {
    if (titlebarZone.contains(el)) return true;
    if (rightSidebarTopbar?.contains(el)) return true;
    if (titlebarHost?.contains(el)) return true;
    return false;
  }

  function pointerOverTitlebarReveal(): boolean {
    const hit = elementUnderPointer();
    if (hit && isTitlebarRevealElement(hit)) return true;
    // Fallback before the first pointermove (e.g. tests).
    if (titlebarZone.matches(":hover")) return true;
    if (rightSidebarTopbar?.matches(":hover")) return true;
    if (rightSidebarTitlebarToggle?.matches(":hover")) return true;
    if (titlebarMoreCluster?.matches(":hover")) return true;
    return false;
  }

  function commitHideTitlebarZone(): void {
    titlebarZone.classList.remove("is-revealed");
    const active = document.activeElement;
    if (active instanceof HTMLElement && titlebarHost?.contains(active)) {
      active.blur();
    }
  }

  function revealTitlebarZone(): void {
    if (!isAutoHideTitlebarEnabled()) return;
    if (titlebarHideTimer != null) {
      clearTimeout(titlebarHideTimer);
      titlebarHideTimer = null;
    }
    titlebarZone.classList.add("is-revealed");
  }

  function scheduleHideTitlebarZone(): void {
    if (!isAutoHideTitlebarEnabled()) return;
    if (titlebarHideTimer != null) clearTimeout(titlebarHideTimer);
    titlebarHideTimer = setTimeout(() => {
      titlebarHideTimer = null;
      if (pointerOverTitlebarReveal()) return;
      commitHideTitlebarZone();
    }, TITLEBAR_HIDE_DELAY_MS);
  }

  function syncTitlebarAutoHide(): void {
    if (!isAutoHideTitlebarEnabled()) {
      commitHideTitlebarZone();
      return;
    }
    if (pointerOverTitlebarReveal()) {
      revealTitlebarZone();
      return;
    }
    if (titlebarHideTimer != null) {
      clearTimeout(titlebarHideTimer);
      titlebarHideTimer = null;
    }
    commitHideTitlebarZone();
  }

  function bindTitlebarRevealTarget(el: HTMLElement | null | undefined): void {
    if (!el || titlebarRevealTargets.includes(el)) return;
    titlebarRevealTargets.push(el);
    el.addEventListener("pointerenter", revealTitlebarZone);
    el.addEventListener("pointerleave", scheduleHideTitlebarZone);
  }

  bindTitlebarRevealTarget(titlebarZone);
  bindTitlebarRevealTarget(rightSidebarTopbar);

  postLayoutTitlebarSync = () => {
    queueMicrotask(() => syncTitlebarAutoHide());
    requestAnimationFrame(() => syncTitlebarAutoHide());
  };

  const titlebarHostEl = document.createElement("header");
  titlebarHost = titlebarHostEl;
  titlebar = mountTitleBar(titlebarHostEl, {
    title: "Untitled",
    onClose: options.onCloseRequest,
    moreMenuActions: options.moreMenuActions,
    immersiveMenuActions: options.immersiveMenuActions,
    graphActions: options.graphActions,
    exportActions: options.exportActions,
    onConfigureSidebarTabs: options.onConfigureSidebarTabs,
    mountMoreClusterExtras: options.mountMoreClusterExtras,
    sidebarToggle: {
      open: sidebarOpen,
      onToggle: toggleSidebar,
    },
    rightSidebarToggle: {
      open: rightSidebarOpen,
      onToggle: toggleRightSidebar,
    },
  });
  sidebar.onToggleSidebar(toggleSidebar);
  rightSidebar.onToggleSidebar(toggleRightSidebar);

  const editorPane = document.createElement("div");
  editorPane.className = "inimark-editor-pane";
  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host inimark-scrollbar";
  editorPane.append(editorHost);
  graph.setEditorHost(editorPane);

  titlebarMoreCluster = titlebarHostEl.querySelector(".inimark-titlebar-more-cluster");
  rightSidebarTitlebarToggle = titlebarHostEl.querySelector(
    ".inimark-right-sidebar-titlebar-toggle",
  );
  bindTitlebarRevealTarget(titlebarMoreCluster);
  bindTitlebarRevealTarget(rightSidebarTitlebarToggle);

  titlebarZone.append(titlebarHostEl);

  mainColumn.append(titlebarZone, editorPane);
  host.append(sidebarHost, mainColumn, rightSidebarHost);
  applySidebarWidth();
  applyRightSidebarWidth();
  applySidebarState();
  applyRightSidebarState();
  syncTitlebarAutoHide();
  // Enable sidebar spring after the initial open/closed layout is painted.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      host.classList.add("is-chrome-ready");
    });
  });

  const resize: ColumnResizeController = attachColumnResize(sidebarHost, {
    side: "left",
    minWidth: SIDEBAR_WIDTH_MIN,
    maxWidth: SIDEBAR_WIDTH_MAX,
    getWidth: () => sidebarWidth,
    onWidthChange(width) {
      sidebarWidth = width;
      applySidebarWidth();
      persistWidth(SIDEBAR_WIDTH_KEY, width);
    },
  });

  const rightResize: ColumnResizeController = attachColumnResize(rightSidebarHost, {
    side: "right",
    minWidth: RIGHT_SIDEBAR_WIDTH_MIN,
    maxWidth: RIGHT_SIDEBAR_WIDTH_MAX,
    getWidth: () => rightSidebarWidth,
    onWidthChange(width) {
      rightSidebarWidth = width;
      applyRightSidebarWidth();
      persistWidth(RIGHT_SIDEBAR_WIDTH_KEY, width);
    },
  });

  let dirty = false;
  let fileName: string | null = null;

  function renderTitle() {
    const base = fileName ?? t("common.untitled");
    titlebar.setTitle(dirty ? `${base} •` : base);
  }

  const unsubscribeLocale = onLocaleChange(() => renderTitle());

  return {
    editorHost,
    editorPane,
    mainColumn,
    sidebar,
    rightSidebar,
    graph,
    tags,
    ai,
    setFileName(name) {
      fileName = name;
      renderTitle();
    },
    setDirty(value) {
      dirty = value;
      renderTitle();
    },
    isDirty() {
      return dirty;
    },
    toggleSidebar,
    refreshPinnableChrome() {
      titlebar.refreshPinnableChrome();
    },
    refreshGraphChrome() {
      titlebar.refreshPinnableChrome();
    },
    toggleRightSidebar,
    focusSearch,
    focusAi,
    applySidebarTabLayout,
    destroy() {
      unsubscribeLocale();
      postLayoutTitlebarSync = null;
      document.removeEventListener("pointermove", onDocumentPointerMove);
      if (pointerMoveHideTimer != null) {
        clearTimeout(pointerMoveHideTimer);
        pointerMoveHideTimer = null;
      }
      if (titlebarHideTimer != null) {
        clearTimeout(titlebarHideTimer);
        titlebarHideTimer = null;
      }
      for (const el of titlebarRevealTargets) {
        el.removeEventListener("pointerenter", revealTitlebarZone);
        el.removeEventListener("pointerleave", scheduleHideTitlebarZone);
      }
      titlebarRevealTargets.length = 0;
      titlebarZone.classList.remove("is-revealed");
      host.classList.remove("is-chrome-ready");
      resize.destroy();
      rightResize.destroy();
      titlebar.destroy();
      sidebar.destroy();
      rightSidebar.destroy();
      graph.destroy();
      tags.destroy();
      ai.destroy();
      host.replaceChildren();
    },
  };
}
