import type {
  ChatProvider,
  ChatRequest,
  ChatStreamEvent,
} from "../types.ts";
import { streamHttpRaw } from "./http-stream.ts";
import {
  consumeSseBuffer,
  parseSseDataPayload,
  toOpenAiMessages,
  toOpenAiTools,
} from "./sse.ts";

export interface OpenAiCompatConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  useSystemProxy: boolean;
}

function joinChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

/**
 * OpenAI-compatible chat provider (OpenAI, DeepSeek, custom).
 * Merges `req.extras` into the JSON body (thinking / reasoning_effort / …).
 */
export function createOpenAiCompatProvider(config: OpenAiCompatConfig): ChatProvider {
  return {
    id: config.id,
    async *streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent> {
      const url = joinChatCompletionsUrl(config.baseUrl);
      if (!url) {
        yield { type: "error", message: "Base URL is empty" };
        return;
      }

      const body: Record<string, unknown> = {
        model: req.model,
        messages: toOpenAiMessages(req.messages),
        stream: true,
        ...(req.extras ?? {}),
      };
      if (req.tools?.length) {
        body.tools = toOpenAiTools(req.tools);
        body.tool_choice = "auto";
      }

      try {
        let buffer = "";
        for await (const chunk of streamHttpRaw(
          {
            url,
            headers: { Authorization: `Bearer ${config.apiKey}` },
            body,
            useSystemProxy: config.useSystemProxy,
          },
          signal,
        )) {
          buffer += chunk;
          const consumed = consumeSseBuffer(buffer);
          buffer = consumed.rest;
          for (const ev of consumed.events) {
            yield ev;
            if (ev.type === "error") return;
          }
        }
        if (buffer.trim()) {
          const consumed = consumeSseBuffer(`${buffer}\n`);
          for (const ev of consumed.events) yield ev;
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

export { parseSseDataPayload };
