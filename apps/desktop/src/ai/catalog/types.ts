/** Provider / model catalog contracts (product effort → native request). */

export type ProviderId = "deepseek" | "openai" | "anthropic" | "gemini" | "custom";

export type ProviderProtocol = "openai_compat" | "anthropic" | "gemini";

/** Product-facing thinking intensity (UI). */
export type EffortId = "off" | "low" | "medium" | "high";

export const EFFORT_IDS: readonly EffortId[] = ["off", "low", "medium", "high"];

/**
 * How a model applies a given effort level.
 * Resolve turns this into `model` overrides + protocol `extras`.
 */
export type ThinkingStrategy =
  | { kind: "none" }
  | { kind: "model_swap"; model: string }
  | { kind: "openai_reasoning_effort"; effort: string }
  | { kind: "anthropic_thinking"; thinking: Record<string, unknown> }
  | { kind: "gemini_thinking"; thinkingConfig: Record<string, unknown> }
  | {
      kind: "deepseek_thinking";
      thinking: Record<string, unknown>;
      reasoning_effort?: string;
    };

export interface EffortProfile {
  id: EffortId;
  /** Whether vault agent tools may be sent at this effort. */
  toolsAllowed: boolean;
  strategy: ThinkingStrategy;
}

export interface ModelProfile {
  /** API model id (also prefs `modelId`). */
  id: string;
  providerId: ProviderId;
  labelKey: string;
  efforts: EffortProfile[];
  defaultEffort: EffortId;
}

export interface ProviderProfile {
  id: ProviderId;
  protocol: ProviderProtocol;
  labelKey: string;
  defaultBaseUrl: string;
  /** Catalog models; empty for `custom`. */
  models: ModelProfile[];
  /** Default model id when switching to this provider. */
  defaultModelId: string;
}

export interface ResolvedChatCall {
  providerId: ProviderId;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  toolsAllowed: boolean;
  effort: EffortId;
  /** Protocol-specific body fields merged by the adapter. */
  extras: Record<string, unknown>;
}
