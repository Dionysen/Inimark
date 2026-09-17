/** Effort parsing and legacy fast/deep aliases. */

import { EFFORT_IDS, type EffortId } from "./types.ts";

/** Legacy composer values before the effort catalog. */
export type LegacyThinkingMode = "fast" | "deep";

export function parseEffortId(raw: unknown): EffortId {
  if (typeof raw === "string" && (EFFORT_IDS as readonly string[]).includes(raw)) {
    return raw as EffortId;
  }
  // Migrate old fast/deep prefs.
  if (raw === "deep") return "high";
  if (raw === "fast") return "off";
  return "off";
}

/** @deprecated Prefer EffortId; kept for older call sites / tests. */
export type AiThinkingMode = LegacyThinkingMode;

/** @deprecated Prefer EFFORT_IDS. */
export const AI_THINKING_MODES: readonly AiThinkingMode[] = ["fast", "deep"];

/** @deprecated Prefer parseEffortId. */
export function parseAiThinkingMode(raw: unknown): AiThinkingMode {
  const effort = parseEffortId(raw);
  return effort === "high" || effort === "medium" || effort === "low" ? "deep" : "fast";
}

export function effortLabelKey(id: EffortId): string {
  switch (id) {
    case "off":
      return "ai.effort.off";
    case "low":
      return "ai.effort.low";
    case "medium":
      return "ai.effort.medium";
    case "high":
      return "ai.effort.high";
  }
}
