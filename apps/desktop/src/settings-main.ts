import "./ui/tokens.css";
import "./styles/settings.css";
import { mountSettingsView } from "./settings/view.ts";
import { applySettings, loadSettings } from "./settings/store.ts";

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("Settings root element #app not found");
}

applySettings(loadSettings());

mountSettingsView(host, {
  onChange: (settings) => {
    applySettings(settings);
  },
});
