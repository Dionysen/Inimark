import "./styles/shell.css";
import {
  bindCloseRequested,
  bootShellChrome,
  closeWindow,
  initPlatform,
  isTauri,
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
import {
  applySettings,
  isExternalSettingsSync,
  loadSettings,
  parseSettingsSyncPayload,
  publishEditorWidthCeiling,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
} from "./settings/store.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { installGitOauthDeepLinkHandler } from "./git-sync/oauth-deeplink.ts";
import { mountGitSyncStatusBar } from "./git-sync/status-bar.ts";
import { createQuitFlow, promptCloudBackupFailure } from "./git-sync/quit-backup.ts";
import {
  CLOUD_SYNC_REQUEST,
  CLOUD_SYNC_RESULT,
  isSyncBusy,
  syncErrorText,
  type CloudSyncRequest,
} from "./git-sync/manual-sync.ts";
import { getSession, pushBackup } from "@dionysen/git-sync";
import { VELLUM_GIT_SYNC } from "./git-sync/config.ts";
import { createImmediateSaver } from "./library/immediate-save.ts";
import { startPeriodicBackup, writeLocalPwbBackup } from "./library/local-backup.ts";
import { mountPlaintextEditor } from "./editor/plaintext.ts";
import { mountEditorContextMenu } from "./editor/context-menu.ts";
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
const teardownClose = bindCloseRequested(() => {
  void requestQuit();
});
const teardownTooltips = initTooltipLayer();
const teardownShortcutGuard = installNativeShortcutGuard();
let libraryApi: {
  save(options?: { quiet?: boolean }): Promise<void>;
  newChapter(): Promise<void>;
  renameSelection(): void;
  renameOpenChapter(): void;
  canRenameOpenChapter(): boolean;
  deleteSelection(): Promise<void>;
  copySelection(): Promise<void>;
  pasteClipboard(): Promise<void>;
} | null = null;
let toggleSidebarRef: (() => void) | null = null;
let requestQuit = (): Promise<void> => closeWindow();
/** Flush pending edits; assigned by mountShell once the saver exists. */
let flushSaver = (): Promise<void> => Promise.resolve();
const teardownShortcuts = mountShortcutHandler({
  "open-settings": () => void openSettingsWindow(),
  close: () => void requestQuit(),
  save: () => {
    void flushSaver().then(() => libraryApi?.save());
  },
  "new-chapter": () => void libraryApi?.newChapter(),
  "toggle-sidebar": () => toggleSidebarRef?.(),
  "tree-rename": () => libraryApi?.renameSelection(),
  "tree-delete": () => void libraryApi?.deleteSelection(),
  "tree-copy": () => void libraryApi?.copySelection(),
  "tree-paste": () => void libraryApi?.pasteClipboard(),
});
let teardownDeepLink: (() => void) | undefined;
void installGitOauthDeepLinkHandler().then((fn) => {
  teardownDeepLink = fn;
});

const onSettingsStorage = (event: StorageEvent): void => {
  if (event.key === SETTINGS_STORAGE_KEY) {
    applySettings(loadSettings());
  }
};
window.addEventListener("storage", onSettingsStorage);

let unlistenSettings: (() => void) | undefined;
if (isTauri()) {
  void import("@tauri-apps/api/event").then(async ({ listen }) => {
    unlistenSettings = await listen(SETTINGS_SYNC_EVENT, (event) => {
      const payload = parseSettingsSyncPayload(event.payload);
      if (!payload || !isExternalSettingsSync(payload)) return;
      applySettings(payload.settings);
    });
  });
}

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
  editorHost.className = "vellum-editor-host inimark-scrollbar";

  let openArticleId: string | null = null;
  let openChain = Promise.resolve();
  const saver = createImmediateSaver(() => libraryApi?.save({ quiet: true }) ?? Promise.resolve());
  flushSaver = () => saver.flush();
  let stopLocalBackup: (() => void) | null = null;
  let syncStatus: ReturnType<typeof mountGitSyncStatusBar> | null = null;
  let teardownSyncStatus = (): void => {
    syncStatus?.destroy();
  };

  const editor = mountPlaintextEditor(editorHost, {
    placeholder: t("editor.placeholder"),
    onChange: () => {
      saver.kick();
      syncStatus?.markEdited();
    },
  });
  const editorContextMenu = mountEditorContextMenu(editorHost, editor);

  /** Click the gutter beside the writing column to focus the editor. */
  editorHost.addEventListener("pointerdown", (event) => {
    if (event.target === editorHost) editor.focus();
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

  let immersive = false;
  function setImmersive(next: boolean): void {
    immersive = next;
    shell.classList.toggle("is-immersive", next);
  }

  const titleBar = mountTitleBar(titleHost, {
    title: t("app.name"),
    onClose: () => void requestQuit(),
    sidebarToggle: {
      open: sidebarOpen,
      onToggle: toggleSidebar,
    },
    menuActions: {
      getImmersive: () => immersive,
      onToggleImmersive() {
        setImmersive(!immersive);
      },
      canRename: () => libraryApi?.canRenameOpenChapter() ?? false,
      onRename() {
        if (immersive) setImmersive(false);
        if (!sidebarOpen) {
          sidebarOpen = true;
          applySidebarState();
        }
        libraryApi?.renameOpenChapter();
      },
    },
  });

  const library = mountLibraryPanel(libraryHost, {
    t: (key, params) => t(key, params),
    getEditorContent: () => editor.getValue(),
    getOpenArticleId: () => openArticleId,
    onArticleOpen: (title, content, id) => {
      openChain = openChain.then(async () => {
        await saver.flush();
        openArticleId = id;
        editor.setValue(content);
        titleBar.setTitle(id ? title || t("app.untitled") : t("app.name"));
        if (id) editor.focus();
      });
    },
    onStatus: () => { },
    onOpenSettings: () => void openSettingsWindow(),
    onToggleSidebar: toggleSidebar,
  });
  libraryApi = library;
  toggleSidebarRef = toggleSidebar;
  requestQuit = createQuitFlow({
    flushEdits: () => saver.flush(),
    cloudReady: async () => {
      const session = await getSession(VELLUM_GIT_SYNC.appId);
      return session.loggedIn && Boolean(session.repoFullName);
    },
    startBackground: async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("pw_detach_cloud_backup", {
        input: {
          appId: VELLUM_GIT_SYNC.appId,
          successTitle: t("quit.cloudDoneTitle"),
          successBody: t("quit.cloudDone"),
          failTitle: t("quit.cloudFailedTitle"),
          failMessage: t("quit.cloudFailedMessage"),
          retryLabel: t("quit.retry"),
          exitLabel: t("quit.exit"),
        },
      });
    },
    askRetry: (error) =>
      promptCloudBackupFailure({
        title: t("quit.cloudFailedTitle"),
        message: t("quit.cloudFailedMessage", { error }),
        retryLabel: t("quit.retry"),
        exitLabel: t("quit.exit"),
      }),
    destroy: () => closeWindow(),
  });
  stopLocalBackup = startPeriodicBackup(async () => {
    await saver.flush();
    await writeLocalPwbBackup();
  });

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
  const runEditorSync = (): void => {
    void (async () => {
      try {
        await saver.flush();
        await pushBackup(VELLUM_GIT_SYNC.appId);
      } catch (err) {
        if (!isSyncBusy(err)) return;
      }
    })();
  };
  syncStatus = mountGitSyncStatusBar(syncStatusHost, { onSync: runEditorSync });
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen, emit }) => {
      const unlistenRequest = await listen<CloudSyncRequest>(CLOUD_SYNC_REQUEST, (event) => {
        void (async () => {
          const id = event.payload?.id;
          if (!id) return;
          try {
            await saver.flush();
            const result = await pushBackup(VELLUM_GIT_SYNC.appId);
            await emit(CLOUD_SYNC_RESULT, {
              id,
              ok: true,
              path: result.path,
              remoteBackupCount: result.remoteBackupCount,
            });
          } catch (err) {
            await emit(CLOUD_SYNC_RESULT, {
              id,
              ok: false,
              busy: isSyncBusy(err),
              error: syncErrorText(err),
            });
          }
        })();
      });
      teardownSyncStatus = () => {
        unlistenRequest();
        syncStatus?.destroy();
      };
    });
    void getSession(VELLUM_GIT_SYNC.appId).then((session) => {
      if (session.lastSyncAt) syncStatus?.noteSynced();
    });
  }

  function publishWidthCeiling(): void {
    publishEditorWidthCeiling(editorHost.clientWidth || editorColumn.clientWidth);
  }

  /**
   * Half-viewport end padding so the last line can scroll to the vertical
   * center of the editor (and the top of the document can rest mid-screen).
   */
  function applyEditorScrollPad(): void {
    const pad = Math.max(0, Math.floor(editorHost.clientHeight * 0.5));
    editorHost.style.setProperty("--vellum-editor-scroll-pad", `${pad}px`);
  }

  publishWidthCeiling();
  applyEditorScrollPad();
  const widthObserver = new ResizeObserver(() => {
    publishWidthCeiling();
    applyEditorScrollPad();
  });
  widthObserver.observe(editorHost);

  editor.focus();

  window.addEventListener("beforeunload", () => {
    stopLocalBackup?.();
    widthObserver.disconnect();
    unlistenSettings?.();
    window.removeEventListener("storage", onSettingsStorage);
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
    editorContextMenu.destroy();
    editor.destroy();
  });
}
