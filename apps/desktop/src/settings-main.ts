import "./ui/tokens.css";
import "./styles/settings.css";
import { LIBRARIES_STORAGE_KEY } from "./libraries/store.ts";
import { mountSettingsView } from "./settings/view.ts";
import { applySettings, loadSettings, SETTINGS_STORAGE_KEY } from "./settings/store.ts";

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("Settings root element #app not found");
}

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
