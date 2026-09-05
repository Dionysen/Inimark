import { initPlatform } from "./platform/platform.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { initFullscreenChrome } from "./platform/window-chrome.ts";
import { initThemeManager } from "./themes/manager.ts";
import { mountApp } from "./app.ts";

initPlatform();
const teardownFullscreen = initFullscreenChrome();
const teardownScrollbars = initAutoHideScrollbars();

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount point");
}

void initThemeManager().then(() => {
  const app = mountApp(root);

  window.addEventListener("beforeunload", () => {
    teardownFullscreen();
    teardownScrollbars();
    app.destroy();
  });
});
