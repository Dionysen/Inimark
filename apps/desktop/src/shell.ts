import { mountSidebar, type SidebarController } from "./sidebar.ts";
import { mountTitleBar } from "./ui/titlebar.ts";

export interface ShellController {
  editorHost: HTMLElement;
  sidebar: SidebarController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
  destroy(): void;
}

export function mountShell(host: HTMLElement): ShellController {
  host.innerHTML = "";
  host.className = "inimark-shell";

  const sidebarHost = document.createElement("aside");
  const sidebar = mountSidebar(sidebarHost);

  const mainColumn = document.createElement("div");
  mainColumn.className = "inimark-main";

  const titlebarHost = document.createElement("header");
  const titlebar = mountTitleBar(titlebarHost, {
    appName: "Inimark",
    title: "Untitled",
  });

  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host";

  mainColumn.append(titlebarHost, editorHost);
  host.append(sidebarHost, mainColumn);

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
