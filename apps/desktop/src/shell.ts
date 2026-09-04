import { mountSidebar, type SidebarController } from "./sidebar.ts";
import { mountTitleBar } from "./ui/titlebar.ts";

const SIDEBAR_OPEN_KEY = "inimark-sidebar-open";

export interface ShellController {
  editorHost: HTMLElement;
  sidebar: SidebarController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
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

export function mountShell(host: HTMLElement): ShellController {
  host.innerHTML = "";
  host.className = "inimark-shell";

  const sidebarHost = document.createElement("aside");
  const sidebar = mountSidebar(sidebarHost);

  const mainColumn = document.createElement("div");
  mainColumn.className = "inimark-main";

  let sidebarOpen = loadSidebarOpen();

  const titlebarHost = document.createElement("header");
  const titlebar = mountTitleBar(titlebarHost, {
    title: "Untitled",
    sidebarToggle: {
      open: sidebarOpen,
      onToggle: () => {
        sidebarOpen = !sidebarOpen;
        localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
        applySidebarState();
      },
    },
  });

  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host";

  mainColumn.append(titlebarHost, editorHost);
  host.append(sidebarHost, mainColumn);

  function applySidebarState(): void {
    host.classList.toggle("is-sidebar-closed", !sidebarOpen);
    sidebarHost.classList.toggle("is-collapsed", !sidebarOpen);
    titlebar.setSidebarOpen(sidebarOpen);
  }

  applySidebarState();

  let dirty = false;
  let fileName: string | null = null;

  function renderTitle() {
    const base = fileName ?? "Untitled";
    titlebar.setTitle(dirty ? `${base} •` : base);
  }

  return {
    editorHost,
    sidebar,
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
    destroy() {
      titlebar.destroy();
      sidebar.destroy();
      host.replaceChildren();
    },
  };
}
