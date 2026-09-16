import type { ChatToolDefinition } from "../types.ts";

/** OpenAI-compatible tool schemas for the document agent. */
export const AGENT_TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    name: "get_active_note",
    description: "Return the currently open note path and full markdown body.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description: "Read a text file from the vault by relative path.",
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
    description: "List files and directories under a vault-relative path (\"\" = vault root).",
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
    description: "Search note names and markdown contents for a query string.",
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
    description: "Open a vault note in the editor.",
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

export const AGENT_SYSTEM_PROMPT = `You are Inimark's document assistant inside a local Markdown vault.
- Prefer tools to read and edit files; do not invent file contents.
- Paths are vault-relative (forward slashes). Use apply_edit for surgical changes and write_file for new/full rewrites.
- When using apply_edit, old_string must match exactly once — include enough context.
- Answer in the user's language. Keep replies concise; show key edits via tools rather than dumping whole files.
- Never claim you edited a file unless a write tool succeeded.`;
