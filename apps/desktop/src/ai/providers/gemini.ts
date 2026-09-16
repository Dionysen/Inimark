/**
 * Google Gemini generateContent streaming adapter (SSE via alt=sse).
 * @see https://ai.google.dev/api/generate-content
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
import { consumeSseDataLines } from "./sse-buffer.ts";

export interface GeminiConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  useSystemProxy: boolean;
}

function streamUrl(baseUrl: string, model: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  const encoded = encodeURIComponent(model);
  return `${trimmed}/models/${encoded}:streamGenerateContent?alt=sse`;
}

function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: unknown[];
} {
  const systemParts: string[] = [];
  const contents: unknown[] = [];

  for (const m of messages) {
    if (m.role === "system" && m.content) {
      systemParts.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.name ?? "tool",
              response: { result: m.content ?? "" },
            },
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.arguments || "{}");
        } catch {
          args = {};
        }
        parts.push({
          functionCall: { name: tc.name, args },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content ?? "" }],
    });
  }

  return {
    systemInstruction: systemParts.length
      ? { parts: [{ text: systemParts.join("\n\n") }] }
      : undefined,
    contents,
  };
}

function toGeminiTools(tools: ChatToolDefinition[]): unknown[] {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

/** Parse one Gemini SSE JSON payload into stream events. */
export function parseGeminiSsePayload(raw: string): ChatStreamEvent[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[DONE]") return [];
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return [{ type: "error", message: `Invalid Gemini SSE: ${trimmed.slice(0, 120)}` }];
  }
  if (!json || typeof json !== "object") return [];
  const obj = json as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          thought?: boolean;
          functionCall?: { name?: string; args?: unknown };
        }>;
      };
    }>;
  };

  if (obj.error?.message) {
    return [{ type: "error", message: obj.error.message }];
  }

  const events: ChatStreamEvent[] = [];
  const parts = obj.candidates?.[0]?.content?.parts ?? [];
  const toolCalls: ChatToolCall[] = [];

  for (const part of parts) {
    if (part.functionCall?.name) {
      toolCalls.push({
        id: `gemini-${toolCalls.length}`,
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args ?? {}),
      });
      continue;
    }
    if (typeof part.text === "string" && part.text) {
      if (part.thought) {
        events.push({ type: "reasoning_delta", text: part.text });
      } else {
        events.push({ type: "text_delta", text: part.text });
      }
    }
  }

  if (toolCalls.length) {
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i]!;
      events.push({
        type: "tool_call_delta",
        index: i,
        id: tc.id,
        name: tc.name,
        argumentsDelta: tc.arguments,
      });
    }
    events.push({
      type: "message_end",
      message: { role: "assistant", content: null, toolCalls },
    });
  }

  return events;
}

export function createGeminiProvider(config: GeminiConfig): ChatProvider {
  return {
    id: config.id,
    async *streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent> {
      const url = streamUrl(config.baseUrl, req.model);
      if (!config.baseUrl.trim()) {
        yield { type: "error", message: "Base URL is empty" };
        return;
      }

      const { systemInstruction, contents } = toGeminiContents(req.messages);
      const generationConfig: Record<string, unknown> = {};
      const extras = req.extras ?? {};
      if (extras.thinkingConfig && typeof extras.thinkingConfig === "object") {
        generationConfig.thinkingConfig = extras.thinkingConfig;
      }

      const body: Record<string, unknown> = {
        contents,
        generationConfig,
      };
      if (systemInstruction) body.systemInstruction = systemInstruction;
      if (req.tools?.length) {
        body.tools = toGeminiTools(req.tools);
      }

      try {
        let buffer = "";
        for await (const chunk of streamHttpRaw(
          {
            url,
            headers: { "x-goog-api-key": config.apiKey },
            body,
            useSystemProxy: config.useSystemProxy,
          },
          signal,
        )) {
          buffer += chunk;
          const { payloads, rest } = consumeSseDataLines(buffer);
          buffer = rest;
          for (const payload of payloads) {
            for (const ev of parseGeminiSsePayload(payload)) {
              yield ev;
              if (ev.type === "error") return;
            }
          }
        }
        if (buffer.trim()) {
          const { payloads } = consumeSseDataLines(`${buffer}\n`);
          for (const payload of payloads) {
            for (const ev of parseGeminiSsePayload(payload)) yield ev;
          }
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
