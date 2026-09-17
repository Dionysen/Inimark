import "./styles/shell.css";
import {
  bindCloseRequested,
  bootShellChrome,
  closeWindow,
  initPlatform,
  requestOverlayScrollbarRefresh,
} from "@dionysen/shell";
import {
  attachColumnResize,
  initTooltipLayer,
  loadPersistedWidth,
  persistWidth,
} from "@dionysen/ui";
import { initThemeManager } from "@dionysen/theme";
import { initI18n, t } from "./i18n/index.ts";
import {
  configureVellumTheme,
  migrateLegacyAppearanceFromSettings,
} from "./themes/configure.ts";
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
const SIDEBAR_WIDTH_KEY = "vellum-sidebar-width";
const SIDEBAR_WIDTH_DEFAULT = 280;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 480;

function loadSidebarOpen(): boolean {
  const raw = localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (raw === null) return true;
  return raw !== "0" && raw !== "false";
}

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
migrateLegacyAppearanceFromSettings();
configureVellumTheme();
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

void initThemeManager().then(() => {
  // Mount continues below after theme is ready — body of shell setup.
  mountShell(root);
});

function mountShell(shell: HTMLElement): void {
shell.className = "vellum-shell";

let sidebarOpen = loadSidebarOpen();
let sidebarWidth = loadPersistedWidth(
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
);

const libraryHost = document.createElement("aside");
libraryHost.className = "vellum-library-host inimark-sidebar";

const mainColumn = document.createElement("div");
mainColumn.className = "vellum-main";

const titlebarZone = document.createElement("div");
titlebarZone.className = "vellum-titlebar-zone";
const titleHost = document.createElement("div");

const editorColumn = document.createElement("div");
editorColumn.className = "vellum-editor-column";

const editorHost = document.createElement("div");
editorHost.className = "vellum-editor-host";

let openArticleId: string | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function clearAutosave(): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

function scheduleAutosave(): void {
  clearAutosave();
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void librarySave?.();
  }, 800);
}

const editor = mountPlaintextEditor(editorHost, {
  placeholder: t("editor.placeholder"),
  onChange: () => scheduleAutosave(),
});

function applySidebarWidth(): void {
  shell.style.setProperty("--vellum-library-width", `${sidebarWidth}px`);
}

function applySidebarState(): void {
  shell.classList.toggle("is-sidebar-closed", !sidebarOpen);
  libraryHost.classList.toggle("is-collapsed", !sidebarOpen);
  titleBar.setSidebarOpen(sidebarOpen);
  library.setSidebarOpen(sidebarOpen);
  localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
  requestOverlayScrollbarRefresh();
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
    clearAutosave();
    openArticleId = id;
    editor.setValue(content);
    titleBar.setTitle(id ? title || t("app.untitled") : t("app.name"));
    if (id) editor.focus();
  },
  onStatus: () => {},
  onOpenSettings: () => void openSettingsWindow(),
  onToggleSidebar: toggleSidebar,
});
librarySave = () => library.save();

applySidebarWidth();
applySidebarState();

const columnResize = attachColumnResize(libraryHost, {
  side: "left",
  minWidth: SIDEBAR_WIDTH_MIN,
  maxWidth: SIDEBAR_WIDTH_MAX,
  getWidth: () => sidebarWidth,
  onWidthChange(width) {
    sidebarWidth = width;
    applySidebarWidth();
    persistWidth(SIDEBAR_WIDTH_KEY, width);
    requestOverlayScrollbarRefresh();
  },
});

editorColumn.append(editorHost);
titlebarZone.append(titleHost);
mainColumn.append(titlebarZone, editorColumn);
shell.append(libraryHost, mainColumn);

const syncStatusHost = document.createElement("div");
syncStatusHost.className = "vellum-git-sync-status-host";
shell.append(syncStatusHost);
const teardownSyncStatus = mountGitSyncStatusBar(syncStatusHost);

editor.focus();

window.addEventListener("beforeunload", () => {
  clearAutosave();
  teardownDeepLink?.();
  teardownSyncStatus();
  columnResize.destroy();
  teardownClose();
  teardownShell();
  teardownTooltips();
  teardownShortcutGuard();
  teardownShortcuts();
  titleBar.destroy();
  library.destroy();
  editor.destroy();
});
}
