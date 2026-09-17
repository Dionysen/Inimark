/** Resolve prefs + effort into a concrete chat call. */

import { parseEffortId } from "./effort.ts";
import {
  customModelProfile,
  getModelProfile,
  getProviderProfile,
} from "./registry.ts";
import type {
  EffortId,
  EffortProfile,
  ModelProfile,
  ProviderId,
  ResolvedChatCall,
  ThinkingStrategy,
} from "./types.ts";

export interface ResolveChatCallInput {
  providerId: ProviderId;
  modelId: string;
  /** Override catalog default base URL when non-empty. */
  baseUrlOverride?: string;
  /** Required for `custom` provider. */
  customBaseUrl?: string;
  customModel?: string;
  apiKey: string;
  effort: EffortId | string;
}

function strategyToResolved(
  baseModel: string,
  strategy: ThinkingStrategy,
): { model: string; extras: Record<string, unknown> } {
  switch (strategy.kind) {
    case "none":
      return { model: baseModel, extras: {} };
    case "model_swap":
      return { model: strategy.model, extras: {} };
    case "openai_reasoning_effort":
      return {
        model: baseModel,
        extras: { reasoning_effort: strategy.effort },
      };
    case "anthropic_thinking":
      return {
        model: baseModel,
        extras: { thinking: strategy.thinking },
      };
    case "gemini_thinking":
      return {
        model: baseModel,
        extras: { thinkingConfig: strategy.thinkingConfig },
      };
    case "deepseek_thinking": {
      const extras: Record<string, unknown> = { thinking: strategy.thinking };
      if (strategy.reasoning_effort) {
        extras.reasoning_effort = strategy.reasoning_effort;
      }
      return { model: baseModel, extras };
    }
  }
}

function pickEffort(model: ModelProfile, requested: EffortId): EffortProfile {
  const exact = model.efforts.find((e) => e.id === requested);
  if (exact) return exact;
  const fallback =
    model.efforts.find((e) => e.id === model.defaultEffort) ?? model.efforts[0];
  if (!fallback) {
    return { id: "off", toolsAllowed: true, strategy: { kind: "none" } };
  }
  return fallback;
}

/**
 * Map settings + composer effort to protocol-ready call parameters.
 * Unknown models under a built-in provider fall back to that provider's default model.
 */
export function resolveChatCall(input: ResolveChatCallInput): ResolvedChatCall {
  const provider =
    getProviderProfile(input.providerId) ?? getProviderProfile("deepseek")!;
  const effort = parseEffortId(input.effort);

  let modelProfile: ModelProfile;
  let baseUrl: string;
  let modelId: string;

  if (provider.id === "custom") {
    modelId = (input.customModel ?? input.modelId).trim() || "custom-model";
    modelProfile = customModelProfile(modelId);
    baseUrl = (input.customBaseUrl ?? input.baseUrlOverride ?? "").trim();
  } else {
    modelProfile =
      getModelProfile(provider.id, input.modelId) ??
      getModelProfile(provider.id, provider.defaultModelId) ??
      provider.models[0]!;
    modelId = modelProfile.id;
    const override = input.baseUrlOverride?.trim();
    baseUrl = override || provider.defaultBaseUrl;
  }

  const effortProfile = pickEffort(modelProfile, effort);
  const { model, extras } = strategyToResolved(modelId, effortProfile.strategy);

  return {
    providerId: provider.id,
    protocol: provider.protocol,
    baseUrl,
    apiKey: input.apiKey,
    model,
    toolsAllowed: effortProfile.toolsAllowed,
    effort: effortProfile.id,
    extras,
  };
}

/** Efforts the composer should offer for the active prefs. */
export function effortsForPrefs(input: {
  providerId: ProviderId;
  modelId: string;
  customModel?: string;
}): EffortProfile[] {
  if (input.providerId === "custom") {
    return customModelProfile(input.customModel?.trim() || "custom").efforts;
  }
  const model =
    getModelProfile(input.providerId, input.modelId) ??
    getModelProfile(input.providerId, getProviderProfile(input.providerId)?.defaultModelId ?? "");
  return model?.efforts ?? [{ id: "off", toolsAllowed: true, strategy: { kind: "none" } }];
}
