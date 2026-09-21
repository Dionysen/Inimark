import { onLocaleChange } from "./i18n/index.ts";
import {
  mountOutlinePanel,
  type OutlinePanelController,
  type OutlineSelectHandler,
} from "./sidebar/outline-panel.ts";
import {
  DEFAULT_RIGHT_SIDEBAR_TABS,
  type SidebarTabId,
} from "./sidebar/tab-layout.ts";
import { loadSettings } from "./settings/store.ts";
import { mountSidebarTopbar } from "./sidebar/vue/mount-sidebar-topbar.ts";
import { FULLSCREEN_CHANGE_EVENT } from "./platform/window-chrome.ts";

export type RightSidebarPanelId = SidebarTabId;

const RIGHT_PANEL_KEY = "inimark-right-sidebar-panel";

export interface RightSidebarController {
  setContent(markdown: string): void;
  setSidebarOpen(open: boolean): void;
  setTabs(ids: SidebarTabId[], panels: Partial<Record<SidebarTabId, HTMLElement>>): void;
  activatePanel(id: SidebarTabId): void;
  hasTab(id: SidebarTabId): boolean;
  onToggleSidebar(handler: () => void): void;
  onSelectHeading(handler: OutlineSelectHandler): void;
  onActivateTab(handler: (id: SidebarTabId) => void): void;
  destroy(): void;
}

export interface RightSidebarMountOptions {
  outlinePanel?: HTMLElement;
  outline?: OutlinePanelController;
}

function loadActivePanel(available: SidebarTabId[]): SidebarTabId {
  try {
    const saved = localStorage.getItem(RIGHT_PANEL_KEY);
    if (saved && available.includes(saved as SidebarTabId)) {
      return saved as SidebarTabId;
    }
  } catch {
    /* ignore */
  }
  return available[0] ?? "outline";
}

export function mountRightSidebar(
  host: HTMLElement,
  options: RightSidebarMountOptions = {},
): RightSidebarController {
  host.className = "inimark-sidebar inimark-right-sidebar";

  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar inimark-right-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "");

  let activateHandler: (id: SidebarTabId) => void = () => {};

  let tabIds: SidebarTabId[] = (() => {
    const settings = loadSettings();
    return settings.rightSidebarTabs.length > 0
      ? [...settings.rightSidebarTabs]
      : [...DEFAULT_RIGHT_SIDEBAR_TABS];
  })();
  const initialActivePanel = loadActivePanel(tabIds);
  let panelElements: Partial<Record<SidebarTabId, HTMLElement>> = {};

  const topbarController = mountSidebarTopbar(topbar, {
    tabs: tabIds,
    activeId: initialActivePanel,
    side: "right",
    onSelect: (id) => setActivePanel(id),
    onToggle: () => handlers.toggleSidebar(),
  });

  const body = document.createElement("div");
  body.className = "inimark-sidebar-body";

  let outlinePanelHost = options.outlinePanel;
  let outline: OutlinePanelController;
  if (options.outline && outlinePanelHost) {
    outline = options.outline;
  } else {
    outlinePanelHost = document.createElement("div");
    outlinePanelHost.className = "inimark-sidebar-panel";
    outlinePanelHost.dataset.panel = "outline";
    outlinePanelHost.setAttribute("role", "tabpanel");
    outline = mountOutlinePanel(outlinePanelHost);
  }

  panelElements = { outline: outlinePanelHost };
  body.append(outlinePanelHost);
  host.append(topbar, body);

  let activePanel: RightSidebarPanelId = initialActivePanel;
  const handlers = {
    toggleSidebar: (): void => {},
  };

  function refreshChrome(): void {
    topbarController.refreshLabels();
  }

  function setActivePanel(panel: RightSidebarPanelId): void {
    if (tabIds.length === 0) return;
    if (!tabIds.includes(panel)) panel = tabIds[0]!;
    activePanel = panel;
    try {
      localStorage.setItem(RIGHT_PANEL_KEY, panel);
    } catch {
      /* ignore */
    }
    topbarController.setActivePanel(panel);
    for (const id of tabIds) {
      const el = panelElements[id];
      if (el) el.hidden = id !== panel;
    }
    activateHandler(panel);
  }

  function updateTabVisibility(): void {
    topbarController.reflow();
  }

  function applyTabs(
    ids: SidebarTabId[],
    panels: Partial<Record<SidebarTabId, HTMLElement>>,
  ): void {
    tabIds = [...ids];
    panelElements = { ...panels };
    topbarController.setTabs(tabIds);
    body.replaceChildren();
    for (const id of tabIds) {
      const el = panelElements[id];
      if (el) body.append(el);
    }
    if (tabIds.length === 0) {
      queueMicrotask(() => updateTabVisibility());
      return;
    }
    if (!tabIds.includes(activePanel)) {
      activePanel = loadActivePanel(tabIds);
    }
    setActivePanel(activePanel);
    queueMicrotask(() => updateTabVisibility());
  }

  setActivePanel(activePanel);
  document.addEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);
  queueMicrotask(() => updateTabVisibility());

  const unsubscribeLocale = onLocaleChange(() => refreshChrome());

  return {
    setContent(markdown) {
      outline.setContent(markdown);
    },
    setSidebarOpen(open) {
      topbarController.setSidebarOpen(open);
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
    onToggleSidebar(handler) {
      handlers.toggleSidebar = handler;
    },
    onSelectHeading(handler) {
      outline.onSelectHeading(handler);
    },
    onActivateTab(handler) {
      activateHandler = handler;
    },
    destroy() {
      unsubscribeLocale();
      document.removeEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);
      topbarController.destroy();
      outline.destroy();
      host.replaceChildren();
    },
  };
}
