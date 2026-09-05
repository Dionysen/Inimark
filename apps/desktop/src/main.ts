import { initPlatform } from "./platform/platform.ts";
import { installChromeGuards } from "./platform/chrome-guards.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { initFullscreenChrome } from "./platform/window-chrome.ts";
import { initThemeManager } from "./themes/manager.ts";
import { initI18n } from "./i18n/index.ts";
import { loadSettings } from "./settings/store.ts";
import { mountApp } from "./app.ts";

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
const teardownChromeGuards = installChromeGuards();
const teardownFullscreen = initFullscreenChrome();
const teardownScrollbars = initAutoHideScrollbars();

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount point");
}

void initThemeManager().then(() => {
  const app = mountApp(root);

  window.addEventListener("beforeunload", () => {
    teardownChromeGuards();
    teardownFullscreen();
    teardownScrollbars();
    app.destroy();
  });
});
