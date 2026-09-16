/** Built-in AI provider / model registry. */

import type {
  EffortProfile,
  ModelProfile,
  ProviderId,
  ProviderProfile,
} from "./types.ts";

function offOnly(toolsAllowed = true): EffortProfile[] {
  return [{ id: "off", toolsAllowed, strategy: { kind: "none" } }];
}

function deepseekThinkingEfforts(): EffortProfile[] {
  // Official: thinking enabled/disabled + reasoning_effort low|high|max
  // (medium/xhigh coerce on the server; we send canonical values).
  // Thinking mode supports tool calls.
  return [
    {
      id: "off",
      toolsAllowed: true,
      strategy: {
        kind: "deepseek_thinking",
        thinking: { type: "disabled" },
      },
    },
    {
      id: "low",
      toolsAllowed: true,
      strategy: {
        kind: "deepseek_thinking",
        thinking: { type: "enabled" },
        reasoning_effort: "low",
      },
    },
    {
      id: "medium",
      toolsAllowed: true,
      strategy: {
        kind: "deepseek_thinking",
        thinking: { type: "enabled" },
        reasoning_effort: "high",
      },
    },
    {
      id: "high",
      toolsAllowed: true,
      strategy: {
        kind: "deepseek_thinking",
        thinking: { type: "enabled" },
        reasoning_effort: "max",
      },
    },
  ];
}

function openaiReasoningEfforts(): EffortProfile[] {
  return [
    {
      id: "off",
      toolsAllowed: true,
      strategy: { kind: "openai_reasoning_effort", effort: "none" },
    },
    {
      id: "low",
      toolsAllowed: true,
      strategy: { kind: "openai_reasoning_effort", effort: "low" },
    },
    {
      id: "medium",
      toolsAllowed: true,
      strategy: { kind: "openai_reasoning_effort", effort: "medium" },
    },
    {
      id: "high",
      toolsAllowed: true,
      strategy: { kind: "openai_reasoning_effort", effort: "high" },
    },
  ];
}

function anthropicThinkingEfforts(): EffortProfile[] {
  return [
    { id: "off", toolsAllowed: true, strategy: { kind: "none" } },
    {
      id: "low",
      toolsAllowed: true,
      strategy: {
        kind: "anthropic_thinking",
        thinking: { type: "enabled", budget_tokens: 2048 },
      },
    },
    {
      id: "medium",
      toolsAllowed: true,
      strategy: {
        kind: "anthropic_thinking",
        thinking: { type: "enabled", budget_tokens: 8000 },
      },
    },
    {
      id: "high",
      toolsAllowed: true,
      strategy: {
        kind: "anthropic_thinking",
        thinking: { type: "enabled", budget_tokens: 16000 },
      },
    },
  ];
}

function geminiFlashEfforts(): EffortProfile[] {
  return [
    {
      id: "off",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      },
    },
    {
      id: "low",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 1024, includeThoughts: true },
      },
    },
    {
      id: "medium",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 4096, includeThoughts: true },
      },
    },
    {
      id: "high",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 8192, includeThoughts: true },
      },
    },
  ];
}

function geminiProEfforts(): EffortProfile[] {
  // Gemini 2.5 Pro cannot fully disable thinking; lowest budget still thinks.
  return [
    {
      id: "low",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 1024, includeThoughts: true },
      },
    },
    {
      id: "medium",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 4096, includeThoughts: true },
      },
    },
    {
      id: "high",
      toolsAllowed: true,
      strategy: {
        kind: "gemini_thinking",
        thinkingConfig: { thinkingBudget: 8192, includeThoughts: true },
      },
    },
  ];
}

function model(
  id: string,
  providerId: ProviderId,
  labelKey: string,
  efforts: EffortProfile[],
  defaultEffort: EffortProfile["id"],
): ModelProfile {
  return { id, providerId, labelKey, efforts, defaultEffort };
}

const DEEPSEEK_MODELS: ModelProfile[] = [
  // https://api-docs.deepseek.com/zh-cn/quick_start/pricing
  model(
    "deepseek-flash",
    "deepseek",
    "ai.models.deepseekFlash",
    deepseekThinkingEfforts(),
    "off",
  ),
  model(
    "deepseek-v4-pro",
    "deepseek",
    "ai.models.deepseekV4Pro",
    deepseekThinkingEfforts(),
    "off",
  ),
];

const OPENAI_MODELS: ModelProfile[] = [
  model("gpt-4.1", "openai", "ai.models.gpt41", offOnly(), "off"),
  model("gpt-4.1-mini", "openai", "ai.models.gpt41Mini", offOnly(), "off"),
  model("o4-mini", "openai", "ai.models.o4Mini", openaiReasoningEfforts(), "low"),
  model("o3", "openai", "ai.models.o3", openaiReasoningEfforts(), "medium"),
];

const ANTHROPIC_MODELS: ModelProfile[] = [
  model(
    "claude-sonnet-4-5",
    "anthropic",
    "ai.models.claudeSonnet45",
    anthropicThinkingEfforts(),
    "off",
  ),
  model(
    "claude-opus-4-5",
    "anthropic",
    "ai.models.claudeOpus45",
    anthropicThinkingEfforts(),
    "off",
  ),
  model(
    "claude-haiku-4-5",
    "anthropic",
    "ai.models.claudeHaiku45",
    anthropicThinkingEfforts(),
    "off",
  ),
];

const GEMINI_MODELS: ModelProfile[] = [
  model(
    "gemini-2.5-flash",
    "gemini",
    "ai.models.gemini25Flash",
    geminiFlashEfforts(),
    "off",
  ),
  model(
    "gemini-2.5-pro",
    "gemini",
    "ai.models.gemini25Pro",
    geminiProEfforts(),
    "low",
  ),
];

export const AI_PROVIDERS: readonly ProviderProfile[] = [
  {
    id: "deepseek",
    protocol: "openai_compat",
    labelKey: "ai.providers.deepseek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: DEEPSEEK_MODELS,
    defaultModelId: "deepseek-flash",
  },
  {
    id: "openai",
    protocol: "openai_compat",
    labelKey: "ai.providers.openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: OPENAI_MODELS,
    defaultModelId: "gpt-4.1",
  },
  {
    id: "anthropic",
    protocol: "anthropic",
    labelKey: "ai.providers.anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    models: ANTHROPIC_MODELS,
    defaultModelId: "claude-sonnet-4-5",
  },
  {
    id: "gemini",
    protocol: "gemini",
    labelKey: "ai.providers.gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: GEMINI_MODELS,
    defaultModelId: "gemini-2.5-flash",
  },
  {
    id: "custom",
    protocol: "openai_compat",
    labelKey: "ai.providers.custom",
    defaultBaseUrl: "",
    models: [],
    defaultModelId: "",
  },
];

const PROVIDER_BY_ID = new Map(AI_PROVIDERS.map((p) => [p.id, p]));

export function getProviderProfile(id: string): ProviderProfile | undefined {
  return PROVIDER_BY_ID.get(id as ProviderId);
}

export function getModelProfile(
  providerId: ProviderId,
  modelId: string,
): ModelProfile | undefined {
  const provider = getProviderProfile(providerId);
  if (!provider) return undefined;
  return provider.models.find((m) => m.id === modelId);
}

/** Synthetic profile for custom OpenAI-compatible endpoints (effort: off only). */
export function customModelProfile(modelId: string): ModelProfile {
  return {
    id: modelId,
    providerId: "custom",
    labelKey: "ai.models.custom",
    efforts: offOnly(true),
    defaultEffort: "off",
  };
}

export function isProviderId(value: unknown): value is ProviderId {
  return (
    value === "deepseek" ||
    value === "openai" ||
    value === "anthropic" ||
    value === "gemini" ||
    value === "custom"
  );
}
