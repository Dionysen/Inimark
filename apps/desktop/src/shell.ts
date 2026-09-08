import { onLocaleChange, t } from "./i18n/index.ts";
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
import { mountTitleBar, type TitleBarController, type TitleBarMoreMenuActions } from "./ui/titlebar.ts";
import { mountOutlinePanel } from "./sidebar/outline-panel.ts";
import {
  mountGraphPanel,
  type GraphPanelController,
} from "./sidebar/graph-panel.ts";
import { loadSettings, type AppSettings } from "./settings/store.ts";
import type { SidebarTabId } from "./sidebar/tab-layout.ts";

const SIDEBAR_OPEN_KEY = "inimark-sidebar-open";
const SIDEBAR_WIDTH_KEY = "inimark-sidebar-width";
const SIDEBAR_WIDTH_DEFAULT = 240;
const SIDEBAR_WIDTH_MIN = 180;
const SIDEBAR_WIDTH_MAX = 480;

const RIGHT_SIDEBAR_OPEN_KEY = "inimark-right-sidebar-open";
const RIGHT_SIDEBAR_WIDTH_KEY = "inimark-right-sidebar-width";
const RIGHT_SIDEBAR_WIDTH_DEFAULT = 240;
const RIGHT_SIDEBAR_WIDTH_MIN = 180;
const RIGHT_SIDEBAR_WIDTH_MAX = 420;

export interface ShellController {
  editorHost: HTMLElement;
  editorPane: HTMLElement;
  mainColumn: HTMLElement;
  sidebar: SidebarController;
  rightSidebar: RightSidebarController;
  graph: GraphPanelController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
  toggleSidebar(): void;
  toggleRightSidebar(): void;
  focusSearch(): void;
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
    };
  }

  function applySidebarTabLayout(settings?: AppSettings): void {
    const next = settings ?? loadSettings();
    const panels = collectPanels();
    sidebar.setTabs(next.leftSidebarTabs, panels);
    rightSidebar.setTabs(next.rightSidebarTabs, panels);
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
  }

  function applyRightSidebarState(): void {
    host.classList.toggle("is-right-sidebar-closed", !rightSidebarOpen);
    rightSidebarHost.classList.toggle("is-collapsed", !rightSidebarOpen);
    titlebar.setRightSidebarOpen(rightSidebarOpen);
    rightSidebar.setSidebarOpen(rightSidebarOpen);
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

  const titlebarZone = document.createElement("div");
  titlebarZone.className = "inimark-titlebar-zone";

  const titlebarHost = document.createElement("header");
  titlebar = mountTitleBar(titlebarHost, {
    title: "Untitled",
    onClose: options.onCloseRequest,
    moreMenuActions: options.moreMenuActions,
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

  titlebarZone.append(titlebarHost);
  mainColumn.append(titlebarZone, editorPane);
  host.append(sidebarHost, mainColumn, rightSidebarHost);
  applySidebarWidth();
  applyRightSidebarWidth();
  applySidebarState();
  applyRightSidebarState();

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
    toggleRightSidebar,
    focusSearch,
    applySidebarTabLayout,
    destroy() {
      unsubscribeLocale();
      resize.destroy();
      rightResize.destroy();
      titlebar.destroy();
      sidebar.destroy();
      rightSidebar.destroy();
      graph.destroy();
      host.replaceChildren();
    },
  };
}
