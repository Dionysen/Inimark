/** Shared AI chat / agent types (provider-agnostic). */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  name?: string;
}

export type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_delta"; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { type: "message_end"; message: ChatMessage }
  | { type: "error"; message: string };

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
}

export interface ChatProvider {
  id: string;
  streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent>;
}

export type AttachmentKind = "file" | "directory" | "active-note";

export interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  /** Vault-relative path; empty for active-note when unknown. */
  path: string;
  label: string;
}

export type UiMessageKind = "user" | "assistant" | "tool" | "error";

export interface UiToolCard {
  id: string;
  name: string;
  argsPreview: string;
  status: "pending" | "done" | "error";
  resultPreview?: string;
}

export interface UiChatMessage {
  id: string;
  kind: UiMessageKind;
  /** Markdown or plain text for display. */
  content: string;
  tool?: UiToolCard;
  streaming?: boolean;
  /** Epoch ms when this assistant answer finished (for relative age). */
  endedAt?: number;
}

export interface WriteUndoEntry {
  path: string;
  before: string;
}
