import { t } from "../i18n/index.ts";
import {
  createTextField,
  createToggle,
} from "../ui/widgets/index.ts";
import {
  loadAiPrefs,
  loadAiSecrets,
  saveAiPrefs,
  saveAiSecrets,
  type AiPrefs,
} from "../ai/secrets.ts";

/** Mount the AI settings form into `host` (replaces children). */
export function renderAiSettingsPanel(host: HTMLElement): () => void {
  host.replaceChildren();
  let prefs = loadAiPrefs();
  let secrets = loadAiSecrets();

  function persistPrefs(next: AiPrefs): void {
    prefs = next;
    saveAiPrefs(prefs);
  }

  const keyField = createTextField({
    value: secrets.apiKey,
    placeholder: "sk-…",
    onChange(value) {
      secrets = { apiKey: value };
      saveAiSecrets(secrets);
    },
  });
  keyField.input.type = "password";
  keyField.input.autocomplete = "off";
  keyField.el.dataset.settingId = "ai.apiKey";

  const baseField = createTextField({
    value: prefs.baseUrl,
    onChange(value) {
      persistPrefs({ ...prefs, baseUrl: value.trim() || prefs.baseUrl });
    },
  });
  baseField.el.dataset.settingId = "ai.baseUrl";

  const modelField = createTextField({
    value: prefs.model,
    onChange(value) {
      persistPrefs({ ...prefs, model: value.trim() || prefs.model });
    },
  });
  modelField.el.dataset.settingId = "ai.model";

  const attachToggle = createToggle({
    checked: prefs.attachActiveNote,
    onChange(checked) {
      persistPrefs({ ...prefs, attachActiveNote: checked });
    },
  });
  attachToggle.el.dataset.settingId = "ai.attachActive";

  const proxyToggle = createToggle({
    checked: prefs.useSystemProxy,
    onChange(checked) {
      persistPrefs({ ...prefs, useSystemProxy: checked });
    },
  });
  proxyToggle.el.dataset.settingId = "ai.useSystemProxy";

  function row(title: string, desc: string, control: HTMLElement, id?: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "inimark-settings-row";
    if (id) el.dataset.settingId = id;
    const meta = document.createElement("div");
    meta.className = "inimark-settings-row-meta";
    const h = document.createElement("div");
    h.className = "inimark-settings-row-title";
    h.textContent = title;
    const d = document.createElement("div");
    d.className = "inimark-settings-row-desc";
    d.textContent = desc;
    meta.append(h, d);
    el.append(meta, control);
    return el;
  }

  const title = document.createElement("h3");
  title.className = "inimark-settings-section-title";
  title.textContent = t("settings.nav.ai");

  host.append(
    title,
    row(t("ai.settings.apiKey"), t("ai.settings.apiKeyDesc"), keyField.el, "ai.apiKey"),
    row(t("ai.settings.baseUrl"), t("ai.settings.baseUrlDesc"), baseField.el, "ai.baseUrl"),
    row(t("ai.settings.model"), t("ai.settings.modelDesc"), modelField.el, "ai.model"),
    row(
      t("ai.settings.attachActive"),
      t("ai.settings.attachActiveDesc"),
      attachToggle.el,
      "ai.attachActive",
    ),
    row(
      t("ai.settings.useSystemProxy"),
      t("ai.settings.useSystemProxyDesc"),
      proxyToggle.el,
      "ai.useSystemProxy",
    ),
  );

  return () => {
    host.replaceChildren();
  };
}
