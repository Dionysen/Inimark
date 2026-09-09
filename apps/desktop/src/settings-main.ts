import "./styles/shell.css";
import "./styles/settings.css";
import "./styles/theme-settings.css";
import { initPlatform } from "./platform/platform.ts";
import { installChromeGuards } from "./platform/chrome-guards.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { initFullscreenChrome } from "./platform/window-chrome.ts";
import { initThemeManager } from "./themes/manager.ts";
import { initI18n } from "./i18n/index.ts";
import { LIBRARIES_STORAGE_KEY } from "./libraries/store.ts";
import { mountSettingsView } from "./settings/view.ts";
import {
  applySettings,
  loadSettings,
  type AppSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
} from "./settings/store.ts";
import { isTauri } from "./platform/env.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { openSettingsWindow } from "./settings/window.ts";

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
const teardownChromeGuards = installChromeGuards();
const teardownFullscreen = initFullscreenChrome();
const teardownScrollbars = initAutoHideScrollbars();
const teardownShortcutGuard = installNativeShortcutGuard();
const teardownShortcuts = mountShortcutHandler({
  "open-settings": () => void openSettingsWindow(),
});

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("Settings root element #app not found");
}

host.className = "inimark-settings-shell";

void initThemeManager().then(() => {
  applySettings(loadSettings());

  const view = mountSettingsView(host, {
    onChange: (settings) => {
      applySettings(settings);
    },
  });

  function syncSettingsFromExternal(next?: AppSettings): void {
    applySettings(next ?? loadSettings());
    view.refresh();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      syncSettingsFromExternal();
    }
    if (event.key === LIBRARIES_STORAGE_KEY) {
      view.refresh();
    }
  });

  let unlistenSettings: (() => void) | undefined;
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlistenSettings = await listen<AppSettings>(SETTINGS_SYNC_EVENT, (event) => {
        syncSettingsFromExternal(event.payload);
      });
    });
  }

  window.addEventListener("beforeunload", () => {
    unlistenSettings?.();
    teardownChromeGuards();
    teardownFullscreen();
    teardownScrollbars();
    teardownShortcutGuard();
    teardownShortcuts();
    view.destroy();
  });
});
