export interface ShellController {
  editorHost: HTMLElement;
  setFileName(name: string | null): void;
  setDirty(dirty: boolean): void;
  setStatus(text: string): void;
  onNew(handler: () => void): void;
  onOpen(handler: () => void | Promise<void>): void;
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

  const btnNew = document.createElement("button");
  btnNew.type = "button";
  btnNew.textContent = "New";
  const btnOpen = document.createElement("button");
  btnOpen.type = "button";
  btnOpen.textContent = "Open";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.textContent = "Save";
  const btnSaveAs = document.createElement("button");
  btnSaveAs.type = "button";
  btnSaveAs.textContent = "Save As";
  const btnTheme = document.createElement("button");
  btnTheme.type = "button";
  btnTheme.textContent = "Theme";

  actions.append(btnNew, btnOpen, btnSave, btnSaveAs, btnTheme);
  toolbar.append(title, actions);

  const editorHost = document.createElement("main");
  editorHost.className = "inimark-editor-host";

  const statusBar = document.createElement("footer");
  statusBar.className = "inimark-statusbar";
  statusBar.textContent = "Ready";

  host.append(toolbar, editorHost, statusBar);

  let dirty = false;
  let fileName: string | null = null;
  const handlers = {
    new: (): void => {},
    open: async (): Promise<void> => {},
    save: async (): Promise<void> => {},
    saveAs: async (): Promise<void> => {},
    theme: (): void => {},
  };

  btnNew.addEventListener("click", () => handlers.new());
  btnOpen.addEventListener("click", () => void handlers.open());
  btnSave.addEventListener("click", () => void handlers.save());
  btnSaveAs.addEventListener("click", () => void handlers.saveAs());
  btnTheme.addEventListener("click", () => handlers.theme());

  function renderTitle() {
    const base = fileName ?? "Untitled";
    title.textContent = dirty ? `${base} •` : base;
  }

  return {
    editorHost,
    setFileName(name) {
      fileName = name;
      renderTitle();
    },
    setDirty(value) {
      dirty = value;
      renderTitle();
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
      host.replaceChildren();
    },
  };
}
