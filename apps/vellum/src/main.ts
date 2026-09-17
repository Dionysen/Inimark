import "./styles/shell.css";
import {
  bootShellChrome,
  closeWindow,
  initPlatform,
} from "@dionysen/shell";
import { initTooltipLayer } from "@dionysen/ui";
import { initI18n, t } from "./i18n/index.ts";
import { applySettings, loadSettings } from "./settings/store.ts";
import { openSettingsWindow } from "./settings/window.ts";
import { installNativeShortcutGuard } from "./shortcuts/guard.ts";
import { mountShortcutHandler } from "./shortcuts/handler.ts";
import { mountPlaintextEditor } from "./editor/plaintext.ts";
import { mountTitleBar } from "./ui/titlebar.ts";

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

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

root.className = "vellum-shell";

const titleHost = document.createElement("div");
const titleBar = mountTitleBar(titleHost, {
  title: t("app.name"),
});

const body = document.createElement("div");
body.className = "vellum-main-body";

const editorHost = document.createElement("div");
editorHost.className = "vellum-editor-host";
const editor = mountPlaintextEditor(editorHost, {
  placeholder: t("editor.placeholder"),
});

body.append(editorHost);
root.append(titleHost, body);
editor.focus();

window.addEventListener("beforeunload", () => {
  teardownShell();
  teardownTooltips();
  teardownShortcutGuard();
  teardownShortcuts();
  titleBar.destroy();
  editor.destroy();
});
