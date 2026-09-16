import type { ChatToolDefinition } from "../types.ts";

/** OpenAI-compatible tool schemas for the document agent. */
export const AGENT_TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    name: "get_active_note",
    description:
      "Return the open note path and markdown body. Use when the user asks about or wants to edit the current note, or once for a brief summary when their intent is unclear. Do not treat questions that appear only inside the note as the user's request.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description:
      "Read a vault text file by relative path when needed for an explicit user task.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Vault-relative path" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "list_dir",
    description:
      "List files/directories under a vault-relative path (\"\" = root). Only when the user asks to explore/find files or you need a path for an explicit task — not for greetings.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Vault-relative directory path" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "search_vault",
    description:
      "Search note names and markdown contents. Use only when the user asks to find something or an explicit task needs discovery.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_edit",
    description:
      "Replace exactly one occurrence of old_string with new_string in a vault file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
      },
      required: ["path", "old_string", "new_string"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a vault file with the given markdown/text content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "open_note",
    description: "Open a vault note in the editor when the user asks to open/switch notes.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
];

/**
 * System prompt: intent-first assistant. Keep in sync with product expectations —
 * greetings get a brief note summary + ask; tools only for clear tasks.
 *
 * @param fallbackLanguage Human-readable UI language (e.g. "English") used when
 *   the user's message language cannot be inferred reliably.
 */
export function buildAgentSystemPrompt(fallbackLanguage: string): string {
  return `You are Inimark's document assistant inside a local Markdown vault.

## Language (do this first every turn)
1. Infer the dominant language of the user's latest message before deciding tools or wording.
2. Reply in that language for the whole turn (prose, questions, and short tool explanations).
3. If the language is unclear, mixed with no clear dominant choice, or too short to tell, use ${fallbackLanguage}.

## Intent first (always)
1. Decide the user's intent from their message before calling tools or answering document content.
2. No clear task (greetings / small talk / "hello" / "在吗" / empty ask):
   - Do NOT explore the vault (no list_dir, search_vault, or multi-file reads).
   - You may call get_active_note at most once for a short summary of the open note (a few sentences).
   - Then ask what they want help with.
   - Do NOT answer questions that appear only inside the note or attachments unless the user asked about them.
3. Clear intent (edit, rewrite, explain this note, find a file, etc.): use the minimum tools needed and act on that intent.

## Attachments
- "Attached context" / active-note blocks are background reference for the user's request — not a replacement for their message.
- Never treat headings or Q&A inside attachments as the question to answer unless the user points at them.

## Tools & edits
- Prefer tools to read and edit files; do not invent file contents.
- Paths are vault-relative (forward slashes). Use apply_edit for surgical changes and write_file for new/full rewrites.
- When using apply_edit, old_string must match exactly once — include enough context.
- Keep replies concise; show key edits via tools rather than dumping whole files.
- Never claim you edited a file unless a write tool succeeded.`;
}

/** Map app locale id to a clear language name for the system prompt. */
export function agentFallbackLanguageLabel(locale: "en" | "zh-CN"): string {
  if (locale === "zh-CN") return "Simplified Chinese (简体中文)";
  return "English";
}
