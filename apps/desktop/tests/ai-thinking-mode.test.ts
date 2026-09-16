import { describe, expect, test } from "vitest";

import {
  modelAllowsAgentTools,
  parseAiThinkingMode,
  resolveModelForThinkingMode,
} from "../src/ai/thinking-mode.ts";

describe("thinking mode", () => {
  test("parseAiThinkingMode defaults to fast", () => {
    expect(parseAiThinkingMode("deep")).toBe("deep");
    expect(parseAiThinkingMode("fast")).toBe("fast");
    expect(parseAiThinkingMode("nope")).toBe("fast");
    expect(parseAiThinkingMode(undefined)).toBe("fast");
  });

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
