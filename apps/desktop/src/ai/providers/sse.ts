/**
 * Parse OpenAI-compatible SSE chat.completion.chunk payloads into stream events.
 * Pure helpers for unit tests and the provider client.
 */

import type { ChatMessage, ChatStreamEvent, ChatToolCall } from "../types.ts";

export interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

/** Parse one SSE `data:` payload JSON object into zero or more stream events. */
export function parseSseDataPayload(raw: string): ChatStreamEvent[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return [];
  }
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return [{ type: "error", message: `Invalid SSE JSON: ${trimmed.slice(0, 120)}` }];
  }
  if (!json || typeof json !== "object") return [];
  const obj = json as {
    error?: { message?: string };
    choices?: Array<{
      delta?: {
        content?: string | null;
        reasoning_content?: string | null;
        reasoning?: string | null;
        tool_calls?: Array<{
          index?: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string | null;
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };

  if (obj.error?.message) {
    return [{ type: "error", message: obj.error.message }];
  }

  const events: ChatStreamEvent[] = [];
  const choice = obj.choices?.[0];
  if (!choice) return events;

  const delta = choice.delta;
  const reasoning =
    (typeof delta?.reasoning_content === "string" && delta.reasoning_content) ||
    (typeof delta?.reasoning === "string" && delta.reasoning) ||
    "";
  if (reasoning) {
    events.push({ type: "reasoning_delta", text: reasoning });
  }
  if (delta?.content) {
    events.push({ type: "text_delta", text: delta.content });
  }
  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      events.push({
        type: "tool_call_delta",
        index: tc.index ?? 0,
        id: tc.id,
        name: tc.function?.name,
        argumentsDelta: tc.function?.arguments,
      });
    }
  }

  if (choice.finish_reason && choice.message) {
    const toolCalls: ChatToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id ?? "",
      name: tc.function?.name ?? "",
      arguments: tc.function?.arguments ?? "{}",
    }));
    const message: ChatMessage = {
      role: "assistant",
      content: choice.message.content ?? null,
      toolCalls,
    };
    events.push({ type: "message_end", message });
  }

  return events;
}

/**
 * Feed a raw SSE text buffer (possibly partial). Returns parsed events and
 * leftover incomplete line buffer.
 */
export function consumeSseBuffer(buffer: string): {
  events: ChatStreamEvent[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n");
  const rest = parts.pop() ?? "";
  const events: ChatStreamEvent[] = [];

  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trimStart();
    events.push(...parseSseDataPayload(payload));
  }

  return { events, rest };
}

export function toOpenAiMessages(
  messages: ChatMessage[],
): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content ?? "",
        name: m.name,
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });
}

export function toOpenAiTools(
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
): unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
