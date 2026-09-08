import { onLocaleChange, t } from "./i18n/index.ts";
import {
  createIconButton,
  rightSidebarToggleIcon,
} from "./ui/widgets/index.ts";
import {
  mountOutlinePanel,
  type OutlinePanelController,
  type OutlineSelectHandler,
} from "./sidebar/outline-panel.ts";
import {
  DEFAULT_RIGHT_SIDEBAR_TABS,
  sidebarTabIcon,
  sidebarTabLabel,
  type SidebarTabId,
} from "./sidebar/tab-layout.ts";
import { loadSettings } from "./settings/store.ts";
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

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

export function mountRightSidebar(
  host: HTMLElement,
  options: RightSidebarMountOptions = {},
): RightSidebarController {
  host.className = "inimark-sidebar inimark-right-sidebar";

  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar inimark-right-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "");

  let sidebarOpen = true;
  let activateHandler: (id: SidebarTabId) => void = () => {};

  const collapseBtn = createIconButton({
    label: t("common.collapseRightSidebar"),
    title: t("common.collapseRightSidebar"),
  });
  collapseBtn.className =
    "inimark-sidebar-toggle-btn inimark-right-sidebar-collapse-btn";
  collapseBtn.innerHTML = rightSidebarToggleIcon(true);
  markNoDrag(collapseBtn);

  const tabs = document.createElement("div");
  tabs.className = "inimark-sidebar-tabs";
  tabs.setAttribute("role", "tablist");
  markNoDrag(tabs);

  let tabIds: SidebarTabId[] = (() => {
    const settings = loadSettings();
    return settings.rightSidebarTabs.length > 0
      ? [...settings.rightSidebarTabs]
      : [...DEFAULT_RIGHT_SIDEBAR_TABS];
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

  // Toggle sits on the far right when the right sidebar is open.
  topbar.append(tabs, collapseBtn);

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

  let activePanel: RightSidebarPanelId = loadActivePanel(tabIds);
  const handlers = {
    toggleSidebar: (): void => {},
  };

  collapseBtn.addEventListener("click", () => handlers.toggleSidebar());

  function syncCollapseButton(): void {
    const label = sidebarOpen
      ? t("common.collapseRightSidebar")
      : t("common.expandRightSidebar");
    collapseBtn.innerHTML = rightSidebarToggleIcon(sidebarOpen);
    collapseBtn.title = label;
    collapseBtn.setAttribute("aria-label", label);
  }

  function refreshChrome(): void {
    for (const [id, btn] of tabButtons) {
      const label = sidebarTabLabel(id);
      btn.title = label;
      btn.setAttribute("aria-label", label);
    }
    syncCollapseButton();
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
    for (const [id, btn] of tabButtons) {
      const selected = id === panel;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    }
    for (const id of tabIds) {
      const el = panelElements[id];
      if (el) el.hidden = id !== panel;
    }
    activateHandler(panel);
  }

  function tabStripRightEdge(topbarRect: DOMRect, styles: CSSStyleDeclaration): number {
    const padR = parseFloat(styles.paddingRight) || 0;
    const collapseStyle = getComputedStyle(collapseBtn);
    if (collapseStyle.display !== "none" && collapseStyle.visibility !== "hidden") {
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      return collapseBtn.getBoundingClientRect().left - gap;
    }
    return topbarRect.right - padR;
  }

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
    const available = Math.max(0, tabStripRightEdge(topbarRect, styles) - (topbarRect.left + padL));
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
  const tabVisibilityObserver = new ResizeObserver(() => updateTabVisibility());
  tabVisibilityObserver.observe(topbar);
  document.addEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);
  queueMicrotask(() => updateTabVisibility());

  const unsubscribeLocale = onLocaleChange(() => refreshChrome());

  return {
    setContent(markdown) {
      outline.setContent(markdown);
    },
    setSidebarOpen(open) {
      sidebarOpen = open;
      syncCollapseButton();
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
      tabVisibilityObserver.disconnect();
      document.removeEventListener(FULLSCREEN_CHANGE_EVENT, updateTabVisibility);
      outline.destroy();
      host.replaceChildren();
    },
  };
}
