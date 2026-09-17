import "./styles/shell.css";
import {
  bindCloseRequested,
  bootShellChrome,
  closeWindow,
  initPlatform,
} from "@dionysen/shell";
import { initTooltipLayer } from "@dionysen/ui";
import { initI18n, t } from "./i18n/index.ts";
import { applySettings, loadSettings } from "./settings/store.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { installGitOauthDeepLinkHandler } from "./git-sync/oauth-deeplink.ts";
import { mountGitSyncStatusBar } from "./git-sync/status-bar.ts";
import { mountPlaintextEditor } from "./editor/plaintext.ts";
import { mountLibraryPanel } from "./library/panel.ts";
import { mountTitleBar } from "./ui/titlebar.ts";

const SIDEBAR_OPEN_KEY = "vellum-sidebar-open";

function loadSidebarOpen(): boolean {
  const raw = localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (raw === null) return true;
  return raw !== "0" && raw !== "false";
}

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
applySettings(bootSettings);

const teardownShell = bootShellChrome({
  editableSelector: ".vellum-plaintext-editor, textarea, [contenteditable='true']",
});
const teardownClose = bindCloseRequested();
const teardownTooltips = initTooltipLayer();
const teardownShortcutGuard = installNativeShortcutGuard();
let librarySave: (() => Promise<void>) | null = null;
const teardownShortcuts = mountShortcutHandler({
  "open-settings": () => void openSettingsWindow(),
  close: () => void closeWindow(),
  save: () => void librarySave?.(),
});
let teardownDeepLink: (() => void) | undefined;
void installGitOauthDeepLinkHandler().then((fn) => {
  teardownDeepLink = fn;
});

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

const shell = root;
shell.className = "vellum-shell";

let sidebarOpen = loadSidebarOpen();

const libraryHost = document.createElement("aside");
libraryHost.className = "vellum-library-host";

const mainColumn = document.createElement("div");
mainColumn.className = "vellum-main";

const titlebarZone = document.createElement("div");
titlebarZone.className = "vellum-titlebar-zone";
const titleHost = document.createElement("div");

const editorColumn = document.createElement("div");
editorColumn.className = "vellum-editor-column";

const statusEl = document.createElement("div");
statusEl.className = "vellum-library-status";

const editorHost = document.createElement("div");
editorHost.className = "vellum-editor-host";

let openArticleId: string | null = null;

const editor = mountPlaintextEditor(editorHost, {
  placeholder: t("editor.placeholder"),
});

function applySidebarState(): void {
  shell.classList.toggle("is-sidebar-closed", !sidebarOpen);
  libraryHost.classList.toggle("is-collapsed", !sidebarOpen);
  titleBar.setSidebarOpen(sidebarOpen);
  library.setSidebarOpen(sidebarOpen);
  localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
}

function toggleSidebar(): void {
  sidebarOpen = !sidebarOpen;
  applySidebarState();
}

const titleBar = mountTitleBar(titleHost, {
  title: t("app.name"),
  sidebarToggle: {
    open: sidebarOpen,
    onToggle: toggleSidebar,
  },
});

const library = mountLibraryPanel(libraryHost, {
  t: (key, params) => t(key, params),
  getEditorContent: () => editor.getValue(),
  getOpenArticleId: () => openArticleId,
  onArticleOpen: (title, content, id) => {
    openArticleId = id;
    editor.setValue(content);
    titleBar.setTitle(id ? title || t("app.untitled") : t("app.name"));
    if (id) editor.focus();
  },
  onStatus: (message) => {
    statusEl.textContent = message;
  },
  onOpenSettings: () => void openSettingsWindow(),
  onToggleSidebar: toggleSidebar,
});
librarySave = () => library.save();
applySidebarState();

editorColumn.append(statusEl, editorHost);
titlebarZone.append(titleHost);
mainColumn.append(titlebarZone, editorColumn);
shell.append(libraryHost, mainColumn);

const syncStatusHost = document.createElement("div");
syncStatusHost.className = "vellum-git-sync-status-host";
shell.append(syncStatusHost);
const teardownSyncStatus = mountGitSyncStatusBar(syncStatusHost);

editor.focus();

window.addEventListener("beforeunload", () => {
  teardownDeepLink?.();
  teardownSyncStatus();
  teardownClose();
  teardownShell();
  teardownTooltips();
  teardownShortcutGuard();
  teardownShortcuts();
  titleBar.destroy();
  library.destroy();
  editor.destroy();
});
