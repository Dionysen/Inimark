/**
 * Protocol-agnostic streaming HTTP used by all AI providers.
 * Tauri path: Rust posts url/headers/body and emits raw chunks.
 * Browser path: fetch + ReadableStream.
 */

import { isTauri } from "../../platform/env.ts";

export interface HttpStreamRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  useSystemProxy: boolean;
}

type StreamChunkPayload = {
  requestId: string;
  kind: "chunk" | "data" | "done" | "error";
  payload: string;
};

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Yield raw response body text chunks (not yet parsed as SSE). */
export async function* streamHttpRaw(
  req: HttpStreamRequest,
  signal: AbortSignal,
): AsyncIterable<string> {
  if (isTauri()) {
    yield* streamViaTauri(req, signal);
    return;
  }
  yield* streamViaFetch(req, signal);
}

async function* streamViaTauri(
  req: HttpStreamRequest,
  signal: AbortSignal,
): AsyncIterable<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const requestId = newRequestId();

  const queue: Array<{ kind: "chunk" | "error"; text: string } | { kind: "done" }> = [];
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
      queue.push({ kind: "error", text: payload.payload || "stream error" });
      done = true;
      notify();
      return;
    }
    if (payload.kind === "done") {
      queue.push({ kind: "done" });
      done = true;
      notify();
      return;
    }
    // Prefer raw chunks; also accept legacy `data` SSE payloads for older builds.
    if (payload.kind === "chunk") {
      queue.push({ kind: "chunk", text: payload.payload });
    } else if (payload.kind === "data") {
      queue.push({ kind: "chunk", text: `data: ${payload.payload}\n\n` });
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
        url: req.url,
        headers: req.headers,
        body: req.body,
        useSystemProxy: req.useSystemProxy,
      },
    }).catch((error: unknown) => {
      queue.push({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
      done = true;
      notify();
    });

    while (!done || queue.length > 0) {
      if (signal.aborted) {
        throw new DOMException("cancelled", "AbortError");
      }
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      const next = queue.shift()!;
      if (next.kind === "done") return;
      if (next.kind === "error") {
        throw new Error(next.text);
      }
      yield next.text;
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    unlisten();
  }
}

async function* streamViaFetch(
  req: HttpStreamRequest,
  signal: AbortSignal,
): AsyncIterable<string> {
  const response = await fetch(req.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...req.headers,
    },
    body: JSON.stringify(req.body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
