import "./styles/shell.css";
import "./styles/settings.css";
import "./styles/theme-settings.css";
import { initPlatform } from "./platform/platform.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { initThemeManager } from "./themes/manager.ts";
import { LIBRARIES_STORAGE_KEY } from "./libraries/store.ts";
import { mountSettingsView } from "./settings/view.ts";
import { applySettings, loadSettings, SETTINGS_STORAGE_KEY } from "./settings/store.ts";

initPlatform();
const teardownScrollbars = initAutoHideScrollbars();

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

  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      applySettings(loadSettings());
    }
    if (event.key === LIBRARIES_STORAGE_KEY) {
      view.refresh();
    }
  });

  window.addEventListener("beforeunload", () => {
    teardownScrollbars();
    view.destroy();
  });
});
