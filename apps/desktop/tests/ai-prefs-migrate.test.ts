import { afterEach, describe, expect, test } from "vitest";

import {
  DEFAULT_AI_PREFS,
  getApiKeyForProvider,
  loadAiPrefs,
  loadAiSecrets,
  saveAiPrefs,
  saveAiSecrets,
} from "../src/ai/secrets.ts";

const PREFS_KEY = "inimark:ai-prefs";
const SECRETS_KEY = "inimark:ai-secrets";

afterEach(() => {
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem(SECRETS_KEY);
});

describe("AI prefs / secrets migration", () => {
  test("loads defaults when empty", () => {
    expect(loadAiPrefs()).toEqual(DEFAULT_AI_PREFS);
    expect(loadAiSecrets()).toEqual({ apiKeys: {} });
  });

  test("migrates legacy single apiKey and model fields", () => {
    localStorage.setItem(
      SECRETS_KEY,
      JSON.stringify({ apiKey: "sk-legacy" }),
    );
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        providerId: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        thinkingMode: "deep",
        attachActiveNote: true,
        useSystemProxy: false,
      }),
    );

    const secrets = loadAiSecrets();
    expect(getApiKeyForProvider(secrets, "deepseek")).toBe("sk-legacy");

    const prefs = loadAiPrefs();
    expect(prefs.modelId).toBe("deepseek-flash");
    expect(prefs.effort).toBe("high");
    expect(prefs.useSystemProxy).toBe(false);
    expect(prefs.baseUrlOverride).toBe("");
  });

  test("round-trips new prefs shape", () => {
    saveAiSecrets({ apiKeys: { openai: "sk-o", anthropic: "sk-a" } });
    saveAiPrefs({
      ...DEFAULT_AI_PREFS,
      providerId: "anthropic",
      modelId: "claude-sonnet-4-5",
      effort: "medium",
    });
    expect(getApiKeyForProvider(loadAiSecrets(), "anthropic")).toBe("sk-a");
    expect(loadAiPrefs().providerId).toBe("anthropic");
    expect(loadAiPrefs().effort).toBe("medium");
  });
});
