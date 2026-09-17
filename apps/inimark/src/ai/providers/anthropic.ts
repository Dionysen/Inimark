/**
 * Anthropic Messages API streaming adapter.
 * @see https://docs.anthropic.com/en/api/messages-streaming
 */

import type {
  ChatMessage,
  ChatProvider,
  ChatRequest,
  ChatStreamEvent,
  ChatToolCall,
  ChatToolDefinition,
} from "../types.ts";
import { streamHttpRaw } from "./http-stream.ts";
import { consumeSseBlocks, parseSseBlock } from "./sse-buffer.ts";

export interface AnthropicConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  useSystemProxy: boolean;
}

function joinMessagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/v1/messages")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

function splitSystem(messages: ChatMessage[]): {
  system: string | undefined;
  rest: ChatMessage[];
} {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system" && m.content) {
      systemParts.push(m.content);
    } else {
      rest.push(m);
    }
  }
  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    rest,
  };
}

function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
  const out: unknown[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content ?? "",
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const content: unknown[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.arguments || "{}");
        } catch {
          input = {};
        }
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input,
        });
      }
      out.push({ role: "assistant", content });
      continue;
    }
    out.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content ?? "",
    });
  }
  return out;
}

function toAnthropicTools(tools: ChatToolDefinition[]): unknown[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

/** Parse one Anthropic SSE JSON data object into stream events. */
export function parseAnthropicSseData(
  eventName: string,
  raw: string,
  toolAcc: Map<number, { id: string; name: string; arguments: string }>,
): ChatStreamEvent[] {
  if (!raw.trim() || raw.trim() === "[DONE]") return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [{ type: "error", message: `Invalid Anthropic SSE: ${raw.slice(0, 120)}` }];
  }
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const events: ChatStreamEvent[] = [];

  const type = typeof obj.type === "string" ? obj.type : eventName;

  if (type === "error") {
    const err = obj.error as { message?: string } | undefined;
    events.push({ type: "error", message: err?.message ?? "Anthropic error" });
    return events;
  }

  if (type === "content_block_start") {
    const index = typeof obj.index === "number" ? obj.index : 0;
    const block = obj.content_block as { type?: string; id?: string; name?: string } | undefined;
    if (block?.type === "tool_use") {
      toolAcc.set(index, {
        id: block.id ?? "",
        name: block.name ?? "",
        arguments: "",
      });
    }
    return events;
  }

  if (type === "content_block_delta") {
    const delta = obj.delta as {
      type?: string;
      text?: string;
      thinking?: string;
      partial_json?: string;
    } | undefined;
    if (!delta) return events;
    if (delta.type === "thinking_delta" && delta.thinking) {
      events.push({ type: "reasoning_delta", text: delta.thinking });
    } else if (delta.type === "text_delta" && delta.text) {
      events.push({ type: "text_delta", text: delta.text });
    } else if (delta.type === "input_json_delta" && delta.partial_json) {
      const index = typeof obj.index === "number" ? obj.index : 0;
      const prev = toolAcc.get(index) ?? { id: "", name: "", arguments: "" };
      prev.arguments += delta.partial_json;
      toolAcc.set(index, prev);
      events.push({
        type: "tool_call_delta",
        index,
        id: prev.id || undefined,
        name: prev.name || undefined,
        argumentsDelta: delta.partial_json,
      });
    }
    return events;
  }

  if (type === "message_delta" || type === "message_stop") {
    // Final tool calls are assembled by the agent loop from deltas.
    return events;
  }

  return events;
}

export function createAnthropicProvider(config: AnthropicConfig): ChatProvider {
  return {
    id: config.id,
    async *streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent> {
      const url = joinMessagesUrl(config.baseUrl);
      if (!url) {
        yield { type: "error", message: "Base URL is empty" };
        return;
      }

      const { system, rest } = splitSystem(req.messages);
      const extras = req.extras ?? {};
      const thinking = extras.thinking as { budget_tokens?: number } | undefined;
      const thinkingBudget =
        typeof thinking?.budget_tokens === "number" ? thinking.budget_tokens : 0;
      const body: Record<string, unknown> = {
        model: req.model,
        messages: toAnthropicMessages(rest),
        // Anthropic requires max_tokens > thinking.budget_tokens when thinking is on.
        max_tokens: Math.max(8192, thinkingBudget + 4096),
        stream: true,
        ...extras,
      };
      if (system) body.system = system;
      if (req.tools?.length) {
        body.tools = toAnthropicTools(req.tools);
      }

      const toolAcc = new Map<number, { id: string; name: string; arguments: string }>();

      try {
        let buffer = "";
        for await (const chunk of streamHttpRaw(
          {
            url,
            headers: {
              "x-api-key": config.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body,
            useSystemProxy: config.useSystemProxy,
          },
          signal,
        )) {
          buffer += chunk;
          const { blocks, rest: leftover } = consumeSseBlocks(buffer);
          buffer = leftover;
          for (const block of blocks) {
            const { event, data } = parseSseBlock(block);
            for (const ev of parseAnthropicSseData(event, data, toolAcc)) {
              yield ev;
              if (ev.type === "error") return;
            }
          }
        }
        if (buffer.trim()) {
          const { event, data } = parseSseBlock(buffer.trim());
          for (const ev of parseAnthropicSseData(event, data, toolAcc)) {
            yield ev;
          }
        }

        // Emit message_end with accumulated tool calls if any.
        if (toolAcc.size > 0) {
          const toolCalls: ChatToolCall[] = [...toolAcc.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => ({
              id: v.id,
              name: v.name,
              arguments: v.arguments || "{}",
            }));
          yield {
            type: "message_end",
            message: { role: "assistant", content: null, toolCalls },
          };
        }
      } catch (error) {
        if (signal.aborted) {
          yield { type: "error", message: "cancelled" };
          return;
        }
        yield {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
