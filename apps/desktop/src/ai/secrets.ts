/** AI secrets / provider prefs — not synced via settings broadcast. */

import {
  parseAiThinkingMode,
  type AiThinkingMode,
} from "./thinking-mode.ts";

const SECRETS_KEY = "inimark:ai-secrets";
const PREFS_KEY = "inimark:ai-prefs";

export interface AiSecrets {
  apiKey: string;
}

export interface AiPrefs {
  providerId: string;
  baseUrl: string;
  model: string;
  /** Attach the active note by default when sending. */
  attachActiveNote: boolean;
  useSystemProxy: boolean;
  /** Composer thinking preset: fast reply vs deep reasoning. */
  thinkingMode: AiThinkingMode;
}

export const DEFAULT_AI_PREFS: AiPrefs = {
  providerId: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  attachActiveNote: true,
  useSystemProxy: true,
  thinkingMode: "fast",
};

export function loadAiSecrets(): AiSecrets {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (!raw) return { apiKey: "" };
    const parsed = JSON.parse(raw) as Partial<AiSecrets>;
    return { apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "" };
  } catch {
    return { apiKey: "" };
  }
}

export function saveAiSecrets(secrets: AiSecrets): void {
  localStorage.setItem(SECRETS_KEY, JSON.stringify({ apiKey: secrets.apiKey }));
}

export function loadAiPrefs(): AiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_AI_PREFS };
    const parsed = JSON.parse(raw) as Partial<AiPrefs>;
    return {
      providerId:
        typeof parsed.providerId === "string" ? parsed.providerId : DEFAULT_AI_PREFS.providerId,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_AI_PREFS.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_AI_PREFS.model,
      attachActiveNote:
        parsed.attachActiveNote === undefined
          ? DEFAULT_AI_PREFS.attachActiveNote
          : Boolean(parsed.attachActiveNote),
      useSystemProxy:
        parsed.useSystemProxy === undefined
          ? DEFAULT_AI_PREFS.useSystemProxy
          : Boolean(parsed.useSystemProxy),
      thinkingMode: parseAiThinkingMode(parsed.thinkingMode),
    };
  } catch {
    return { ...DEFAULT_AI_PREFS };
  }
}

export function saveAiPrefs(prefs: AiPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
