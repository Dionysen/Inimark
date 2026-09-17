import "./styles/shell.css";
import "./styles/settings.css";
import {
  bootShellChrome,
  closeWindow,
  initPlatform,
  isTauri,
} from "@dionysen/shell";
import { initTooltipLayer } from "@dionysen/ui";
import { installOauthDeepLinkHandler } from "./cloud/oauth-deeplink.ts";
import { initI18n } from "./i18n/index.ts";
import { mountSettingsView } from "./settings/view.ts";
import {
  applySettings,
  isExternalSettingsSync,
  loadSettings,
  parseSettingsSyncPayload,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
} from "./settings/store.ts";
import { SETTINGS_NAVIGATE_SECTION_KEY } from "./settings/window.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
applySettings(bootSettings);

const teardownShell = bootShellChrome({
  editableSelector: ".vellum-plaintext-editor, textarea, [contenteditable='true']",
});
const teardownTooltips = initTooltipLayer();
const teardownShortcutGuard = installNativeShortcutGuard();
const teardownShortcuts = mountShortcutHandler({
  "open-settings": () => void openSettingsWindow(),
  close: () => void closeWindow(),
});
let teardownDeepLink: (() => void) | undefined;
void installOauthDeepLinkHandler().then((fn) => {
  teardownDeepLink = fn;
});

const host = document.querySelector<HTMLElement>("#app");
if (!host) throw new Error("Missing #app mount point");

const view = mountSettingsView(host);

function applyPendingSection(): void {
  const hash = location.hash.replace(/^#/, "");
  if (hash) {
    view.navigateToSection(hash);
    history.replaceState(null, "", location.pathname + location.search);
    return;
  }
  const stored = localStorage.getItem(SETTINGS_NAVIGATE_SECTION_KEY);
  if (!stored) return;
  localStorage.removeItem(SETTINGS_NAVIGATE_SECTION_KEY);
  view.navigateToSection(stored);
}

applyPendingSection();

window.addEventListener("storage", (event) => {
  if (event.key === SETTINGS_STORAGE_KEY) {
    applySettings(loadSettings());
    view.refresh();
  }
  if (event.key === SETTINGS_NAVIGATE_SECTION_KEY && event.newValue) {
    view.navigateToSection(event.newValue);
    localStorage.removeItem(SETTINGS_NAVIGATE_SECTION_KEY);
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
  teardownDeepLink?.();
  teardownShell();
  teardownTooltips();
  teardownShortcutGuard();
  teardownShortcuts();
  view.destroy();
});
