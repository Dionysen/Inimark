import "./styles/shell.css";
import "./styles/settings.css";
import { initPlatform } from "./platform/platform.ts";
import { initAutoHideScrollbars } from "./platform/scrollbars.ts";
import { LIBRARIES_STORAGE_KEY } from "./libraries/store.ts";
import { mountSettingsView } from "./settings/view.ts";
import { applySettings, loadSettings, SETTINGS_STORAGE_KEY } from "./settings/store.ts";
import { mountTitleBar } from "./ui/titlebar.ts";

initPlatform();
const teardownScrollbars = initAutoHideScrollbars();

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("Settings root element #app not found");
}

host.className = "inimark-settings-shell";

applySettings(loadSettings());

const titlebarHost = document.createElement("header");
const titlebar = mountTitleBar(titlebarHost, {
  title: "Settings",
  controlMode: "close-only",
});

const viewHost = document.createElement("div");
viewHost.className = "inimark-settings-view-host";

host.append(titlebarHost, viewHost);

const view = mountSettingsView(viewHost, {
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
  titlebar.destroy();
  view.destroy();
});
