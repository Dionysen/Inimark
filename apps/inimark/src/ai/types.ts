/** Shared AI chat / agent types (provider-agnostic). */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Multimodal user content (text + inline images). */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mime: string; base64: string };

export interface ChatMessage {
  role: ChatRole;
  /** Plain text, or multimodal parts for vision-capable models. */
  content: string | null | ChatContentPart[];
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  name?: string;
}

/** Flatten message content to plain text (images become short labels). */
export function chatContentToText(content: ChatMessage["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : `[image:${part.mime}]`))
    .join("\n")
    .trim();
}

export type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "reasoning_delta"; text: string }
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
  /** Protocol extras from catalog resolve (thinking / reasoning_effort / …). */
  extras?: Record<string, unknown>;
}

export interface ChatProvider {
  id: string;
  streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent>;
}

export type AttachmentKind = "file" | "directory" | "active-note" | "image";

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
  /** Epoch ms when this UI row was created (used for work-trace duration). */
  createdAt?: number;
  kind: UiMessageKind;
  /** Markdown or plain text for display. */
  content: string;
  /** Model reasoning / chain-of-thought (shown in a collapsible block). */
  reasoning?: string;
  /** True while reasoning tokens are still streaming. */
  reasoningStreaming?: boolean;
  tool?: UiToolCard;
  streaming?: boolean;
  /** Epoch ms when this assistant answer finished (for relative age). */
  endedAt?: number;
}

export interface WriteUndoEntry {
  path: string;
  before: string;
  after: string;
}
