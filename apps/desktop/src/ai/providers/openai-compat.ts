import { isTauri } from "../../platform/env.ts";
import type {
  ChatProvider,
  ChatRequest,
  ChatStreamEvent,
} from "../types.ts";
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

type StreamChunkPayload = {
  requestId: string;
  kind: "data" | "done" | "error";
  payload: string;
};

/**
 * OpenAI-compatible chat provider (DeepSeek and similar).
 * In Tauri, streams via Rust to honor system proxy and avoid CORS.
 */
export function createOpenAiCompatProvider(config: OpenAiCompatConfig): ChatProvider {
  return {
    id: config.id,
    async *streamChat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatStreamEvent> {
      if (isTauri()) {
        yield* streamViaTauri(config, req, signal);
        return;
      }
      yield* streamViaFetch(config, req, signal);
    },
  };
}

async function* streamViaTauri(
  config: OpenAiCompatConfig,
  req: ChatRequest,
  signal: AbortSignal,
): AsyncIterable<ChatStreamEvent> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const queue: ChatStreamEvent[] = [];
  let done = false;
  let wake: (() => void) | null = null;

  const notify = () => {
    wake?.();
    wake = null;
  };

  const unlisten = await listen<StreamChunkPayload>("ai-stream", (event) => {
    const payload = event.payload;
    if (!payload || payload.requestId !== requestId) return;
    if (payload.kind === "error") {
      queue.push({ type: "error", message: payload.payload || "stream error" });
      done = true;
      notify();
      return;
    }
    if (payload.kind === "done") {
      done = true;
      notify();
      return;
    }
    for (const ev of parseSseDataPayload(payload.payload)) {
      queue.push(ev);
    }
    notify();
  });

  const onAbort = () => {
    void invoke("ai_chat_cancel", { requestId }).catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    void invoke("ai_chat_stream", {
      args: {
        requestId,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: req.model,
        messages: toOpenAiMessages(req.messages),
        tools: req.tools ? toOpenAiTools(req.tools) : null,
        useSystemProxy: config.useSystemProxy,
      },
    }).catch((error: unknown) => {
      queue.push({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      done = true;
      notify();
    });

    while (!done || queue.length > 0) {
      if (signal.aborted) {
        yield { type: "error", message: "cancelled" };
        return;
      }
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      const next = queue.shift()!;
      yield next;
      if (next.type === "error") return;
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    unlisten();
  }
}

async function* streamViaFetch(
  config: OpenAiCompatConfig,
  req: ChatRequest,
  signal: AbortSignal,
): AsyncIterable<ChatStreamEvent> {
  const base = config.baseUrl.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: toOpenAiMessages(req.messages),
      tools: req.tools ? toOpenAiTools(req.tools) : undefined,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield {
      type: "error",
      message: `HTTP ${response.status}: ${text.slice(0, 400)}`,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
}
