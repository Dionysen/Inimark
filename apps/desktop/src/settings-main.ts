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
  isExternalSettingsSync,
  loadSettings,
  parseSettingsSyncPayload,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
} from "./settings/store.ts";
import { isTauri } from "./platform/env.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { isSettingsSection } from "./settings/search-index.ts";
import {
  openSettingsWindow,
  SETTINGS_NAVIGATE_SECTION_KEY,
} from "./settings/window.ts";

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

  function applyPendingSettingsSection(): void {
    const hashSection = location.hash.replace(/^#/, "");
    if (isSettingsSection(hashSection)) {
      view.navigateToSection(hashSection);
      history.replaceState(null, "", location.pathname + location.search);
      return;
    }

    const stored = localStorage.getItem(SETTINGS_NAVIGATE_SECTION_KEY);
    if (!stored || !isSettingsSection(stored)) return;
    localStorage.removeItem(SETTINGS_NAVIGATE_SECTION_KEY);
    view.navigateToSection(stored);
  }

  applyPendingSettingsSection();

  function syncSettingsFromExternal(): void {
    applySettings(loadSettings());
    view.refresh();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      syncSettingsFromExternal();
    }
    if (event.key === LIBRARIES_STORAGE_KEY) {
      view.refresh();
    }
    if (event.key === SETTINGS_NAVIGATE_SECTION_KEY && event.newValue) {
      if (isSettingsSection(event.newValue)) {
        view.navigateToSection(event.newValue);
        localStorage.removeItem(SETTINGS_NAVIGATE_SECTION_KEY);
      }
    }
  });

  let unlistenSettings: (() => void) | undefined;
  if (isTauri()) {
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlistenSettings = await listen(SETTINGS_SYNC_EVENT, (event) => {
        const payload = parseSettingsSyncPayload(event.payload);
        if (!payload || !isExternalSettingsSync(payload)) return;
        applySettings(payload.settings);
        view.refresh();
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
