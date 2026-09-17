/**
 * Thinking / effort helpers.
 * Product effort lives in `catalog/`; this module re-exports for older imports
 * and keeps a thin modelAllowsAgentTools for tests that only pass a model id.
 */

export {
  parseEffortId,
  parseAiThinkingMode,
  AI_THINKING_MODES,
  effortLabelKey,
  type AiThinkingMode,
  type EffortId,
} from "./catalog/index.ts";

export { resolveChatCall } from "./catalog/index.ts";

/**
 * @deprecated Prefer ResolvedChatCall.toolsAllowed from resolveChatCall.
 * Heuristic kept for unit tests that only have a model string.
 */
export function modelAllowsAgentTools(model: string): boolean {
  return !model.trim().toLowerCase().includes("reasoner");
}

/**
 * @deprecated Prefer resolveChatCall. Maps legacy fast/deep against DeepSeek ids.
 */
export function resolveModelForThinkingMode(
  settingsModel: string,
  mode: "fast" | "deep",
): string {
  const id = settingsModel.trim().toLowerCase();
  if (mode === "deep") {
    if (id === "deepseek-chat" || id === "deepseek-coder") return "deepseek-reasoner";
    return settingsModel;
  }
  if (id === "deepseek-reasoner") return "deepseek-chat";
  return settingsModel;
}
