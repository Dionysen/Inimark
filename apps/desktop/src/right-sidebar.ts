import {
  createIconButton,
  outlineTabIcon,
  rightSidebarToggleIcon,
} from "./ui/widgets/index.ts";
import {
  mountOutlinePanel,
  type OutlinePanelController,
  type OutlineSelectHandler,
} from "./sidebar/outline-panel.ts";

export type RightSidebarPanelId = "outline";

const RIGHT_PANEL_KEY = "inimark-right-sidebar-panel";

const PANEL_META: Record<RightSidebarPanelId, { label: string; icon: () => string }> = {
  outline: { label: "Outline", icon: outlineTabIcon },
};

export interface RightSidebarController {
  setContent(markdown: string): void;
  setSidebarOpen(open: boolean): void;
  onToggleSidebar(handler: () => void): void;
  onSelectHeading(handler: OutlineSelectHandler): void;
  destroy(): void;
}

function loadActivePanel(): RightSidebarPanelId {
  try {
    const saved = localStorage.getItem(RIGHT_PANEL_KEY);
    if (saved === "outline") return saved;
  } catch {
    /* ignore */
  }
  return "outline";
}

function markNoDrag(el: HTMLElement): void {
  el.setAttribute("data-tauri-drag-region", "false");
  el.style.setProperty("-webkit-app-region", "no-drag");
}

export function mountRightSidebar(host: HTMLElement): RightSidebarController {
  host.className = "inimark-sidebar inimark-right-sidebar";

  const topbar = document.createElement("div");
  topbar.className = "inimark-sidebar-topbar inimark-right-sidebar-topbar";
  topbar.setAttribute("data-tauri-drag-region", "");

  const collapseBtn = createIconButton({
    label: "Collapse right sidebar",
    title: "Collapse right sidebar",
  });
  collapseBtn.className =
    "inimark-sidebar-toggle-btn inimark-right-sidebar-collapse-btn";
  collapseBtn.innerHTML = rightSidebarToggleIcon(true);
  markNoDrag(collapseBtn);

  const tabs = document.createElement("div");
  tabs.className = "inimark-sidebar-tabs";
  tabs.setAttribute("role", "tablist");
  markNoDrag(tabs);

  const tabButtons = new Map<RightSidebarPanelId, HTMLButtonElement>();
  for (const id of Object.keys(PANEL_META) as RightSidebarPanelId[]) {
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

  // Toggle sits on the far right when the right sidebar is open.
  topbar.append(tabs, collapseBtn);

  const body = document.createElement("div");
  body.className = "inimark-sidebar-body";

  const outlinePanelHost = document.createElement("div");
  outlinePanelHost.className = "inimark-sidebar-panel";
  outlinePanelHost.dataset.panel = "outline";
  outlinePanelHost.setAttribute("role", "tabpanel");
  const outline: OutlinePanelController = mountOutlinePanel(outlinePanelHost);

  body.append(outlinePanelHost);
  host.append(topbar, body);

  let activePanel: RightSidebarPanelId = loadActivePanel();
  const handlers = {
    toggleSidebar: (): void => {},
  };

  collapseBtn.addEventListener("click", () => handlers.toggleSidebar());

  function setActivePanel(panel: RightSidebarPanelId): void {
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
    outlinePanelHost.hidden = panel !== "outline";
  }

  for (const [id, btn] of tabButtons) {
    btn.addEventListener("click", () => setActivePanel(id));
  }

  setActivePanel(activePanel);

  return {
    setContent(markdown) {
      outline.setContent(markdown);
    },
    setSidebarOpen(open) {
      collapseBtn.innerHTML = rightSidebarToggleIcon(open);
      collapseBtn.title = open ? "Collapse right sidebar" : "Expand right sidebar";
      collapseBtn.setAttribute(
        "aria-label",
        open ? "Collapse right sidebar" : "Expand right sidebar",
      );
    },
    onToggleSidebar(handler) {
      handlers.toggleSidebar = handler;
    },
    onSelectHeading(handler) {
      outline.onSelectHeading(handler);
    },
    destroy() {
      outline.destroy();
      host.replaceChildren();
    },
  };
}
