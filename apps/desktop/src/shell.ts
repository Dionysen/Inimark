import { createButton } from "./ui/button.ts";
import { mountSidebar, type SidebarController } from "./sidebar.ts";

export interface ShellController {
  editorHost: HTMLElement;
  sidebar: SidebarController;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  isDirty(): boolean;
  setStatus(text: string): void;
  onNew(handler: () => void): void;
  onOpen(handler: () => void | Promise<void>): void;
  onOpenFolder(handler: () => void | Promise<void>): void;
  onSave(handler: () => void | Promise<void>): void;
  onSaveAs(handler: () => void | Promise<void>): void;
  onToggleAppearance(handler: () => void): void;
  destroy(): void;
}

export function mountShell(host: HTMLElement): ShellController {
  host.innerHTML = "";
  host.className = "inimark-shell";

  const toolbar = document.createElement("header");
  toolbar.className = "inimark-toolbar";

  const title = document.createElement("span");
  title.className = "inimark-title";
  title.textContent = "Untitled";

  const actions = document.createElement("div");
  actions.className = "inimark-toolbar-actions";

  const btnNew = createButton({ label: "New", onClick: () => handlers.new() });
  const btnOpen = createButton({ label: "Open", onClick: () => void handlers.open() });
  const btnOpenFolder = createButton({
    label: "Open Folder",
    onClick: () => void handlers.openFolder(),
  });
  const btnSave = createButton({ label: "Save", onClick: () => void handlers.save() });
  const btnSaveAs = createButton({ label: "Save As", onClick: () => void handlers.saveAs() });
  const btnTheme = createButton({ label: "Theme", onClick: () => handlers.theme() });

  actions.append(btnNew, btnOpen, btnOpenFolder, btnSave, btnSaveAs, btnTheme);
  toolbar.append(title, actions);

  const body = document.createElement("div");
  body.className = "inimark-body";

  const sidebarHost = document.createElement("aside");
  const sidebar = mountSidebar(sidebarHost);

  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host";

  body.append(sidebarHost, editorHost);

  const statusBar = document.createElement("footer");
  statusBar.className = "inimark-statusbar";
  statusBar.textContent = "Ready";

  host.append(toolbar, body, statusBar);

  let dirty = false;
  let fileName: string | null = null;
  const handlers = {
    new: (): void => {},
    open: (): void | Promise<void> => {},
    openFolder: (): void | Promise<void> => {},
    save: (): void | Promise<void> => {},
    saveAs: (): void | Promise<void> => {},
    theme: (): void => {},
  };

  sidebar.onOpenFolder(() => handlers.openFolder());

  function renderTitle() {
    const base = fileName ?? "Untitled";
    title.textContent = dirty ? `${base} •` : base;
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
    setStatus(text) {
      statusBar.textContent = text;
    },
    onNew(handler) {
      handlers.new = handler;
    },
    onOpen(handler) {
      handlers.open = handler;
    },
    onOpenFolder(handler) {
      handlers.openFolder = handler;
    },
    onSave(handler) {
      handlers.save = handler;
    },
    onSaveAs(handler) {
      handlers.saveAs = handler;
    },
    onToggleAppearance(handler) {
      handlers.theme = handler;
    },
    destroy() {
      sidebar.destroy();
      host.replaceChildren();
    },
  };
}
