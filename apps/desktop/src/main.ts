import { initPlatform } from "./platform/platform.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { initThemeManager } from "./themes/manager.ts";
import { mountApp } from "./app.ts";

initPlatform();
const teardownScrollbars = initAutoHideScrollbars();

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount point");
}

void initThemeManager().then(() => {
  const app = mountApp(root);

  window.addEventListener("beforeunload", () => {
    teardownScrollbars();
    app.destroy();
  });
});
