import { t } from "../i18n/index.ts";
import type { UiChatMessage, UiToolCard } from "./types.ts";

const KNOWN_TOOLS = [
  "get_active_note",
  "read_file",
  "list_dir",
  "search_vault",
  "apply_edit",
  "write_file",
  "open_note",
] as const;

export type AgentToolName = (typeof KNOWN_TOOLS)[number];

/** Localized display name for an agent tool id. */
export function agentToolLabel(name: string): string {
  if ((KNOWN_TOOLS as readonly string[]).includes(name)) {
    return t(`ai.tools.${name}`);
  }
  return name;
}

/** Localized status for a tool card. */
export function agentToolStatusLabel(status: UiToolCard["status"]): string {
  return t(`ai.toolStatus.${status}`);
}

/** Summary line shown on a collapsed tool card. */
export function formatToolCardSummary(tool: UiToolCard): string {
  return `${agentToolLabel(tool.name)} · ${agentToolStatusLabel(tool.status)}`;
}

function tryPrettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
  } catch {
    return null;
  }
}

function fencedCode(text: string, lang?: string): string {
  const fence = text.includes("```") ? "````" : "```";
  const info = lang ? lang : "";
  return `${fence}${info}\n${text}\n${fence}`;
}

/** Markdown source for the expanded tool card body (rendered like assistant replies). */
export function formatToolCardBody(tool: UiToolCard): string {
  const parts: string[] = [];
  const args = tool.argsPreview.trim();
  if (args) {
    const pretty = tryPrettyJson(args);
    parts.push(
      `**${t("ai.toolSectionArgs")}**\n\n${fencedCode(pretty ?? args, pretty ? "json" : undefined)}`,
    );
  }
  const result = tool.resultPreview?.trim();
  if (result) {
    const pretty = tryPrettyJson(result);
    parts.push(
      pretty
        ? `**${t("ai.toolSectionResult")}**\n\n${fencedCode(pretty, "json")}`
        : `**${t("ai.toolSectionResult")}**\n\n${result}`,
    );
  }
  return parts.join("\n\n");
}

/**
 * Whether this assistant message is the final answer of its turn
 * (last assistant before the next user message / end). Used for the copy control.
 */
export function isFinalAssistantAnswer(
  messages: readonly UiChatMessage[],
  index: number,
): boolean {
  const msg = messages[index];
  if (!msg || msg.kind !== "assistant" || msg.streaming) return false;
  if (!msg.content.trim()) return false;
  for (let i = index + 1; i < messages.length; i++) {
    const next = messages[i]!;
    if (next.kind === "user") break;
    if (next.kind === "assistant" && next.content.trim()) return false;
  }
  return true;
}
