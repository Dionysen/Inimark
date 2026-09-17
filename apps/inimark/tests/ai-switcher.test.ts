import { afterEach, describe, expect, test } from "vitest";

import { listSwitcherModels } from "../src/ai/catalog/index.ts";
import { DEFAULT_AI_PREFS, saveAiPrefs, saveAiSecrets } from "../src/ai/secrets.ts";

const PREFS_KEY = "inimark:ai-prefs";
const SECRETS_KEY = "inimark:ai-secrets";

afterEach(() => {
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem(SECRETS_KEY);
});

describe("listSwitcherModels", () => {
  test("falls back to current provider catalog when no keys", () => {
    saveAiPrefs({ ...DEFAULT_AI_PREFS, providerId: "deepseek" });
    saveAiSecrets({ apiKeys: {} });
    const list = listSwitcherModels();
    expect(list.every((e) => e.providerId === "deepseek")).toBe(true);
    expect(list.some((e) => e.modelId === "deepseek-flash")).toBe(true);
    expect(list.some((e) => e.modelId === "deepseek-v4-pro")).toBe(true);
  });

  test("includes every provider that has an API key", () => {
    saveAiPrefs({ ...DEFAULT_AI_PREFS });
    saveAiSecrets({ apiKeys: { deepseek: "sk-d", openai: "sk-o" } });
    const list = listSwitcherModels();
    const providers = new Set(list.map((e) => e.providerId));
    expect(providers.has("deepseek")).toBe(true);
    expect(providers.has("openai")).toBe(true);
    expect(providers.has("anthropic")).toBe(false);
  });
});
