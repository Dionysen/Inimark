/** Composer thinking-mode presets (fast vs deep reasoning). */

export type AiThinkingMode = "fast" | "deep";

export const AI_THINKING_MODES: readonly AiThinkingMode[] = ["fast", "deep"];

export function parseAiThinkingMode(raw: unknown): AiThinkingMode {
  return raw === "deep" ? "deep" : "fast";
}

/**
 * Map the settings model + thinking mode to the request model.
 * DeepSeek: chat ↔ reasoner; other vendors keep the configured model.
 */
export function resolveModelForThinkingMode(
  settingsModel: string,
  mode: AiThinkingMode,
): string {
  const id = settingsModel.trim().toLowerCase();
  if (mode === "deep") {
    if (id === "deepseek-chat" || id === "deepseek-coder") return "deepseek-reasoner";
    return settingsModel;
  }
  if (id === "deepseek-reasoner") return "deepseek-chat";
  return settingsModel;
}

/** Reasoner-style models generally do not support tool calling. */
export function modelAllowsAgentTools(model: string): boolean {
  return !model.trim().toLowerCase().includes("reasoner");
}
