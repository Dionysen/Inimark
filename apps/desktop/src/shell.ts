import { mountSidebar, type SidebarController } from "./sidebar.ts";
import { mountTitleBar, type TitleBarController } from "./ui/titlebar.ts";

const SIDEBAR_OPEN_KEY = "inimark-sidebar-open";

export interface ShellController {
  editorHost: HTMLElement;
  sidebar: SidebarController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
  toggleSidebar(): void;
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

export interface ShellMountOptions {
  onCloseRequest?: () => void | Promise<void>;
}

export function mountShell(
  host: HTMLElement,
  options: ShellMountOptions = {},
): ShellController {
  host.innerHTML = "";
  host.className = "inimark-shell";

  const sidebarHost = document.createElement("aside");
  const sidebar = mountSidebar(sidebarHost);

  const mainColumn = document.createElement("div");
  mainColumn.className = "inimark-main";

  let sidebarOpen = loadSidebarOpen();
  let titlebar: TitleBarController;

  function applySidebarState(): void {
    host.classList.toggle("is-sidebar-closed", !sidebarOpen);
    sidebarHost.classList.toggle("is-collapsed", !sidebarOpen);
    titlebar.setSidebarOpen(sidebarOpen);
  }

  function toggleSidebar(): void {
    sidebarOpen = !sidebarOpen;
    localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
    applySidebarState();
  }

  const titlebarHost = document.createElement("header");
  titlebar = mountTitleBar(titlebarHost, {
    title: "Untitled",
    onClose: options.onCloseRequest,
    sidebarToggle: {
      open: sidebarOpen,
      onToggle: toggleSidebar,
    },
  });

  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host";

  mainColumn.append(titlebarHost, editorHost);
  host.append(sidebarHost, mainColumn);
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
    toggleSidebar,
    destroy() {
      titlebar.destroy();
      sidebar.destroy();
      host.replaceChildren();
    },
  };
}
