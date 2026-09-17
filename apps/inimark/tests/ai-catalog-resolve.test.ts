import { describe, expect, test } from "vitest";

import {
  effortsForPrefs,
  parseEffortId,
  resolveChatCall,
} from "../src/ai/catalog/index.ts";
import {
  modelAllowsAgentTools,
  parseAiThinkingMode,
  resolveModelForThinkingMode,
} from "../src/ai/thinking-mode.ts";

describe("effort parsing", () => {
  test("parseEffortId accepts catalog ids and legacy aliases", () => {
    expect(parseEffortId("off")).toBe("off");
    expect(parseEffortId("low")).toBe("low");
    expect(parseEffortId("medium")).toBe("medium");
    expect(parseEffortId("high")).toBe("high");
    expect(parseEffortId("fast")).toBe("off");
    expect(parseEffortId("deep")).toBe("high");
    expect(parseEffortId("nope")).toBe("off");
  });

  test("legacy parseAiThinkingMode still maps", () => {
    expect(parseAiThinkingMode("deep")).toBe("deep");
    expect(parseAiThinkingMode("fast")).toBe("fast");
    expect(parseAiThinkingMode("high")).toBe("deep");
    expect(parseAiThinkingMode("off")).toBe("fast");
  });
});

describe("resolveChatCall", () => {
  test("DeepSeek flash maps thinking extras by effort", () => {
    const off = resolveChatCall({
      providerId: "deepseek",
      modelId: "deepseek-flash",
      apiKey: "k",
      effort: "off",
    });
    expect(off.protocol).toBe("openai_compat");
    expect(off.model).toBe("deepseek-flash");
    expect(off.toolsAllowed).toBe(true);
    expect(off.extras).toEqual({ thinking: { type: "disabled" } });

    const high = resolveChatCall({
      providerId: "deepseek",
      modelId: "deepseek-flash",
      apiKey: "k",
      effort: "high",
    });
    expect(high.extras).toEqual({
      thinking: { type: "enabled" },
      reasoning_effort: "max",
    });
    expect(high.toolsAllowed).toBe(true);
  });

  test("DeepSeek v4-pro shares thinking effort mapping", () => {
    const mid = resolveChatCall({
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
      apiKey: "k",
      effort: "medium",
    });
    expect(mid.model).toBe("deepseek-v4-pro");
    expect(mid.extras).toEqual({
      thinking: { type: "enabled" },
      reasoning_effort: "high",
    });
  });

  test("unknown DeepSeek model falls back to default flash", () => {
    const call = resolveChatCall({
      providerId: "deepseek",
      modelId: "deepseek-chat",
      apiKey: "k",
      effort: "off",
    });
    expect(call.model).toBe("deepseek-flash");
  });

  test("OpenAI o4-mini uses reasoning_effort", () => {
    const mid = resolveChatCall({
      providerId: "openai",
      modelId: "o4-mini",
      apiKey: "sk",
      effort: "medium",
    });
    expect(mid.protocol).toBe("openai_compat");
    expect(mid.extras).toEqual({ reasoning_effort: "medium" });
  });

  test("Anthropic high effort includes thinking budget", () => {
    const high = resolveChatCall({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-5",
      apiKey: "sk",
      effort: "high",
    });
    expect(high.protocol).toBe("anthropic");
    expect(high.extras.thinking).toEqual({
      type: "enabled",
      budget_tokens: 16000,
    });
  });

  test("Gemini flash off disables thinking budget", () => {
    const off = resolveChatCall({
      providerId: "gemini",
      modelId: "gemini-2.5-flash",
      apiKey: "k",
      effort: "off",
    });
    expect(off.protocol).toBe("gemini");
    expect(off.extras.thinkingConfig).toEqual({
      thinkingBudget: 0,
      includeThoughts: false,
    });
  });

  test("unsupported effort falls back to model default", () => {
    const call = resolveChatCall({
      providerId: "openai",
      modelId: "gpt-4.1",
      apiKey: "k",
      effort: "high",
    });
    expect(call.effort).toBe("off");
    expect(call.extras).toEqual({});
  });

  test("custom provider is openai_compat with off-only efforts", () => {
    const call = resolveChatCall({
      providerId: "custom",
      modelId: "",
      customBaseUrl: "https://example.com/v1",
      customModel: "my-model",
      apiKey: "k",
      effort: "high",
    });
    expect(call.protocol).toBe("openai_compat");
    expect(call.model).toBe("my-model");
    expect(call.baseUrl).toBe("https://example.com/v1");
    expect(call.effort).toBe("off");
    expect(effortsForPrefs({ providerId: "custom", modelId: "x" })).toHaveLength(1);
  });

  test("baseUrlOverride wins over provider default", () => {
    const call = resolveChatCall({
      providerId: "openai",
      modelId: "gpt-4.1",
      baseUrlOverride: "https://proxy.example/v1",
      apiKey: "k",
      effort: "off",
    });
    expect(call.baseUrl).toBe("https://proxy.example/v1");
  });
});

describe("legacy thinking helpers", () => {
  test("DeepSeek chat ↔ reasoner when switching modes", () => {
    expect(resolveModelForThinkingMode("deepseek-chat", "deep")).toBe("deepseek-reasoner");
    expect(resolveModelForThinkingMode("deepseek-reasoner", "fast")).toBe("deepseek-chat");
    expect(resolveModelForThinkingMode("gpt-4o", "deep")).toBe("gpt-4o");
  });

  test("reasoner models disable tools", () => {
    expect(modelAllowsAgentTools("deepseek-reasoner")).toBe(false);
    expect(modelAllowsAgentTools("deepseek-chat")).toBe(true);
  });
});
