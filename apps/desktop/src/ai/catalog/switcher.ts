/** Models offered in the composer switcher (current + keyed providers). */

import {
  AI_PROVIDERS,
  customModelProfile,
  getProviderProfile,
  type EffortProfile,
  type ModelProfile,
  type ProviderId,
} from "./index.ts";
import {
  getApiKeyForProvider,
  loadAiPrefs,
  loadAiSecrets,
  type AiPrefs,
} from "../secrets.ts";

export interface SwitcherModelEntry {
  providerId: ProviderId;
  /** Catalog / API model id (custom uses customModel). */
  modelId: string;
  labelKey: string;
  efforts: EffortProfile[];
  /** Optional short provider label key for grouped menus. */
  providerLabelKey: string;
}

/**
 * Models the composer can switch to.
 * Prefers every provider that already has an API key (ready for multi-vendor);
 * otherwise falls back to the currently selected provider’s catalog.
 */
export function listSwitcherModels(prefs: AiPrefs = loadAiPrefs()): SwitcherModelEntry[] {
  const secrets = loadAiSecrets();
  const keyed = AI_PROVIDERS.filter((p) => {
    if (p.id === "custom") {
      return Boolean(getApiKeyForProvider(secrets, "custom") && prefs.customModel.trim());
    }
    return Boolean(getApiKeyForProvider(secrets, p.id));
  });

  const providers =
    keyed.length > 0
      ? keyed
      : ([getProviderProfile(prefs.providerId) ?? AI_PROVIDERS[0]!]);

  const out: SwitcherModelEntry[] = [];
  for (const provider of providers) {
    if (provider.id === "custom") {
      const modelId = prefs.customModel.trim() || "custom-model";
      const profile = customModelProfile(modelId);
      out.push({
        providerId: "custom",
        modelId,
        labelKey: profile.labelKey,
        efforts: profile.efforts,
        providerLabelKey: provider.labelKey,
      });
      continue;
    }
    for (const model of provider.models) {
      out.push(entryFromProfile(model, provider.labelKey));
    }
  }
  return out;
}

function entryFromProfile(
  model: ModelProfile,
  providerLabelKey: string,
): SwitcherModelEntry {
  return {
    providerId: model.providerId,
    modelId: model.id,
    labelKey: model.labelKey,
    efforts: model.efforts,
    providerLabelKey,
  };
}

/** Display label for the active prefs model (falls back to model id). */
export function activeModelLabelKey(prefs: AiPrefs = loadAiPrefs()): string {
  if (prefs.providerId === "custom") {
    return "ai.models.custom";
  }
  const provider = getProviderProfile(prefs.providerId);
  const model = provider?.models.find((m) => m.id === prefs.modelId);
  return model?.labelKey ?? "ai.models.custom";
}
