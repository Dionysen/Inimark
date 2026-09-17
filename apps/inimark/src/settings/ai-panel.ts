import { t } from "../i18n/index.ts";
import {
  createSelect,
  createTextField,
  createToggle,
} from "../ui/widgets/index.ts";
import {
  AI_PROVIDERS,
  getProviderProfile,
  type ProviderId,
} from "../ai/catalog/index.ts";
import {
  getApiKeyForProvider,
  loadAiPrefs,
  loadAiSecrets,
  saveAiPrefs,
  saveAiSecrets,
  setApiKeyForProvider,
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

  const title = document.createElement("h3");
  title.className = "inimark-settings-section-title";
  title.textContent = t("settings.nav.ai");

  function row(titleText: string, desc: string, control: HTMLElement, id?: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "inimark-settings-row";
    if (id) el.dataset.settingId = id;
    const meta = document.createElement("div");
    meta.className = "inimark-settings-row-meta";
    const h = document.createElement("div");
    h.className = "inimark-settings-row-title";
    h.textContent = titleText;
    const d = document.createElement("div");
    d.className = "inimark-settings-row-desc";
    d.textContent = desc;
    meta.append(h, d);
    const ctrl = document.createElement("div");
    ctrl.className = "inimark-settings-row-control";
    ctrl.append(control);
    el.append(meta, ctrl);
    return el;
  }

  const providerSelect = createSelect({
    value: prefs.providerId,
    options: AI_PROVIDERS.map((p) => ({
      value: p.id,
      label: t(p.labelKey),
    })),
    minWidth: 180,
    onChange(value) {
      const providerId = value as ProviderId;
      const provider = getProviderProfile(providerId);
      const modelId =
        provider && provider.id !== "custom"
          ? provider.defaultModelId
          : prefs.customModel || prefs.modelId;
      persistPrefs({
        ...prefs,
        providerId,
        modelId: provider?.id === "custom" ? prefs.modelId : modelId,
        effort:
          provider?.id === "custom"
            ? "off"
            : provider?.models.find((m) => m.id === modelId)?.defaultEffort ??
              "off",
      });
      rebuildDynamic();
    },
  });
  providerSelect.el.dataset.settingId = "ai.provider";

  const keyField = createTextField({
    value: getApiKeyForProvider(secrets, prefs.providerId),
    placeholder: "sk-…",
    onChange(value) {
      secrets = setApiKeyForProvider(secrets, prefs.providerId, value);
      saveAiSecrets(secrets);
    },
  });
  keyField.input.type = "password";
  keyField.input.autocomplete = "off";
  keyField.el.dataset.settingId = "ai.apiKey";

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

  const dynamicHost = document.createElement("div");
  dynamicHost.className = "inimark-settings-ai-dynamic";

  function rebuildDynamic(): void {
    dynamicHost.replaceChildren();
    keyField.input.value = getApiKeyForProvider(secrets, prefs.providerId);

    const provider = getProviderProfile(prefs.providerId);
    const isCustom = prefs.providerId === "custom";

    if (isCustom) {
      const baseField = createTextField({
        value: prefs.customBaseUrl,
        placeholder: "https://api.example.com/v1",
        onChange(value) {
          persistPrefs({ ...prefs, customBaseUrl: value.trim() });
        },
      });
      baseField.el.dataset.settingId = "ai.baseUrl";

      const modelField = createTextField({
        value: prefs.customModel,
        placeholder: "model-id",
        onChange(value) {
          persistPrefs({
            ...prefs,
            customModel: value.trim(),
            modelId: value.trim() || prefs.modelId,
          });
        },
      });
      modelField.el.dataset.settingId = "ai.model";

      dynamicHost.append(
        row(t("ai.settings.baseUrl"), t("ai.settings.customBaseUrlDesc"), baseField.el, "ai.baseUrl"),
        row(t("ai.settings.model"), t("ai.settings.customModelDesc"), modelField.el, "ai.model"),
      );
      return;
    }

    const models = provider?.models ?? [];
    const modelSelect = createSelect({
      value: models.some((m) => m.id === prefs.modelId)
        ? prefs.modelId
        : provider?.defaultModelId ?? "",
      options: models.map((m) => ({
        value: m.id,
        label: t(m.labelKey),
      })),
      minWidth: 180,
      onChange(value) {
        const profile = models.find((m) => m.id === value);
        persistPrefs({
          ...prefs,
          modelId: value,
          effort: profile?.defaultEffort ?? "off",
        });
      },
    });
    modelSelect.el.dataset.settingId = "ai.model";

    const baseField = createTextField({
      value: prefs.baseUrlOverride || provider?.defaultBaseUrl || "",
      onChange(value) {
        const trimmed = value.trim();
        const def = provider?.defaultBaseUrl ?? "";
        persistPrefs({
          ...prefs,
          baseUrlOverride: trimmed && trimmed !== def ? trimmed : "",
        });
      },
    });
    baseField.el.dataset.settingId = "ai.baseUrl";

    dynamicHost.append(
      row(t("ai.settings.model"), t("ai.settings.modelDesc"), modelSelect.el, "ai.model"),
      row(t("ai.settings.baseUrl"), t("ai.settings.baseUrlDesc"), baseField.el, "ai.baseUrl"),
    );
  }

  rebuildDynamic();

  host.append(
    title,
    row(t("ai.settings.provider"), t("ai.settings.providerDesc"), providerSelect.el, "ai.provider"),
    row(t("ai.settings.apiKey"), t("ai.settings.apiKeyDesc"), keyField.el, "ai.apiKey"),
    dynamicHost,
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
