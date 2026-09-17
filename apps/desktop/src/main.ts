import { bootShellChrome, initPlatform } from "@dionysen/shell";
import { initImePositionGuard } from "./platform/ime-position.ts";
import { FULLSCREEN_CHANGE_EVENT } from "./platform/window-chrome.ts";
import { initThemeManager } from "./themes/manager.ts";
import { initI18n } from "./i18n/index.ts";
import { loadSettings } from "./settings/store.ts";
import { initTooltipLayer } from "./ui/widgets/tooltip.ts";
import { mountApp } from "./app.ts";

initPlatform();
const bootSettings = loadSettings();
initI18n(bootSettings.locale === "system" ? null : bootSettings.locale);
const teardownShellChrome = bootShellChrome({
  eventName: FULLSCREEN_CHANGE_EVENT,
});
const teardownImePosition = initImePositionGuard();
const teardownTooltips = initTooltipLayer();

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount point");
}

void initThemeManager().then(() => {
  const app = mountApp(root);

  window.addEventListener("beforeunload", () => {
    teardownShellChrome();
    teardownImePosition();
    teardownTooltips();
    app.destroy();
  });
});
