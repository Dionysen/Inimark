/** AI secrets / provider prefs — not synced via settings broadcast. */

import {
  getProviderProfile,
  isProviderId,
  parseEffortId,
  type EffortId,
  type ProviderId,
} from "./catalog/index.ts";

const SECRETS_KEY = "inimark:ai-secrets";
const PREFS_KEY = "inimark:ai-prefs";

export interface AiSecrets {
  apiKeys: Partial<Record<ProviderId, string>>;
}

export interface AiPrefs {
  providerId: ProviderId;
  /** Catalog model id (ignored for custom except as display fallback). */
  modelId: string;
  /** Non-empty overrides the provider default base URL. */
  baseUrlOverride: string;
  /** Custom OpenAI-compatible endpoint. */
  customBaseUrl: string;
  customModel: string;
  attachActiveNote: boolean;
  useSystemProxy: boolean;
  effort: EffortId;
}

export const DEFAULT_AI_PREFS: AiPrefs = {
  providerId: "deepseek",
  modelId: "deepseek-flash",
  baseUrlOverride: "",
  customBaseUrl: "",
  customModel: "",
  attachActiveNote: true,
  useSystemProxy: true,
  effort: "off",
};

function emptySecrets(): AiSecrets {
  return { apiKeys: {} };
}

export function loadAiSecrets(): AiSecrets {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (!raw) return emptySecrets();
    const parsed = JSON.parse(raw) as Partial<AiSecrets> & { apiKey?: string };
    if (parsed.apiKeys && typeof parsed.apiKeys === "object") {
      return { apiKeys: { ...parsed.apiKeys } };
    }
    // Migrate single-key shape → deepseek.
    if (typeof parsed.apiKey === "string" && parsed.apiKey) {
      return { apiKeys: { deepseek: parsed.apiKey } };
    }
    return emptySecrets();
  } catch {
    return emptySecrets();
  }
}

export function saveAiSecrets(secrets: AiSecrets): void {
  localStorage.setItem(SECRETS_KEY, JSON.stringify({ apiKeys: secrets.apiKeys }));
}

export function getApiKeyForProvider(secrets: AiSecrets, providerId: ProviderId): string {
  return secrets.apiKeys[providerId]?.trim() ?? "";
}

export function setApiKeyForProvider(
  secrets: AiSecrets,
  providerId: ProviderId,
  apiKey: string,
): AiSecrets {
  return {
    apiKeys: {
      ...secrets.apiKeys,
      [providerId]: apiKey,
    },
  };
}

function migratePrefs(parsed: Record<string, unknown>): AiPrefs {
  const providerId = isProviderId(parsed.providerId)
    ? parsed.providerId
    : DEFAULT_AI_PREFS.providerId;

  let modelId =
    typeof parsed.modelId === "string" && parsed.modelId.trim()
      ? parsed.modelId.trim()
      : typeof parsed.model === "string" && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_AI_PREFS.modelId;

  // Upgrade legacy default model when still on deepseek-chat with defaults.
  if (
    providerId === "deepseek" &&
    (modelId === "deepseek-chat" || modelId === "deepseek-reasoner") &&
    parsed.modelId == null &&
    typeof parsed.model === "string"
  ) {
    // Keep user's explicit legacy model id from old `model` field.
    modelId = parsed.model.trim();
  }

  const provider = getProviderProfile(providerId);
  if (provider && provider.id !== "custom") {
    const known = provider.models.some((m) => m.id === modelId);
    if (!known) modelId = provider.defaultModelId;
  }

  const baseUrlOverride =
    typeof parsed.baseUrlOverride === "string"
      ? parsed.baseUrlOverride.trim()
      : typeof parsed.baseUrl === "string" &&
          provider &&
          parsed.baseUrl.trim() !== provider.defaultBaseUrl
        ? parsed.baseUrl.trim()
        : "";

  const customBaseUrl =
    typeof parsed.customBaseUrl === "string"
      ? parsed.customBaseUrl.trim()
      : providerId === "custom" && typeof parsed.baseUrl === "string"
        ? parsed.baseUrl.trim()
        : "";

  const customModel =
    typeof parsed.customModel === "string"
      ? parsed.customModel.trim()
      : providerId === "custom" && typeof parsed.model === "string"
        ? parsed.model.trim()
        : "";

  const effort = parseEffortId(
    parsed.effort !== undefined ? parsed.effort : parsed.thinkingMode,
  );

  return {
    providerId,
    modelId,
    baseUrlOverride,
    customBaseUrl,
    customModel,
    attachActiveNote:
      parsed.attachActiveNote === undefined
        ? DEFAULT_AI_PREFS.attachActiveNote
        : Boolean(parsed.attachActiveNote),
    useSystemProxy:
      parsed.useSystemProxy === undefined
        ? DEFAULT_AI_PREFS.useSystemProxy
        : Boolean(parsed.useSystemProxy),
    effort,
  };
}

export function loadAiPrefs(): AiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_AI_PREFS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return migratePrefs(parsed);
  } catch {
    return { ...DEFAULT_AI_PREFS };
  }
}

export function saveAiPrefs(prefs: AiPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
