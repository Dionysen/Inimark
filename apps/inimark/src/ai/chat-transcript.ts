import { t } from "../i18n/index.ts";
import type { UiChatMessage } from "./types.ts";

/** Assistant bubble with non-empty markdown/text (a “real” reply segment). */
export function isVisibleAssistantMessage(msg: UiChatMessage): boolean {
  return msg.kind === "assistant" && msg.content.trim() !== "";
}

/** Intermediate step: tool cards or assistant rows without visible answer text. */
export function isWorkStepMessage(msg: UiChatMessage): boolean {
  if (msg.kind === "tool") return true;
  if (msg.kind === "assistant" && !isVisibleAssistantMessage(msg)) return true;
  return false;
}

export interface UiWorkTraceItem {
  msg: UiChatMessage;
  index: number;
}

export interface UiWorkTrace {
  id: string;
  items: UiWorkTraceItem[];
  startedAt: number;
  endedAt?: number;
  /** True while tools/reasoning for this segment are still in flight. */
  active: boolean;
}

export type ChatDisplayItem =
  | { type: "message"; msg: UiChatMessage; index: number }
  | { type: "work"; trace: UiWorkTrace };

function messageTimestamp(msg: UiChatMessage, fallback: number): number {
  return msg.createdAt ?? fallback;
}

function traceIsActive(items: UiWorkTraceItem[]): boolean {
  return items.some(({ msg }) => {
    if (msg.kind === "tool" && msg.tool?.status === "pending") return true;
    if (msg.reasoningStreaming) return true;
    if (msg.kind === "assistant" && msg.streaming && !msg.content.trim()) return true;
    return false;
  });
}

function traceEndedAt(items: UiWorkTraceItem[], fallback: number): number {
  let end = fallback;
  for (const { msg } of items) {
    end = Math.max(end, msg.endedAt ?? msg.createdAt ?? fallback);
    if (msg.kind === "tool" && msg.tool?.status !== "pending") {
      end = Math.max(end, msg.createdAt ?? fallback);
    }
  }
  return end;
}

function makeWorkTrace(items: UiWorkTraceItem[], now: number): ChatDisplayItem {
  const startedAt = Math.min(...items.map(({ msg }) => messageTimestamp(msg, now)));
  const active = traceIsActive(items);
  const endedAt = active ? undefined : traceEndedAt(items, now);
  return {
    type: "work",
    trace: {
      id: `work:${items[0]!.msg.id}`,
      items: [...items],
      startedAt,
      endedAt,
      active,
    },
  };
}

/**
 * Collapse tool calls and reasoning-only assistant rows between visible outputs
 * into a single “worked for …” trace (Cursor-style).
 */
export function buildChatDisplayItems(
  messages: readonly UiChatMessage[],
  now: number = Date.now(),
): ChatDisplayItem[] {
  const out: ChatDisplayItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i]!;

    if (msg.kind === "user" || msg.kind === "error") {
      out.push({ type: "message", msg, index: i });
      i++;
      continue;
    }

    const workItems: UiWorkTraceItem[] = [];

    while (i < messages.length) {
      const m = messages[i]!;
      if (m.kind === "user" || m.kind === "error") break;

      if (isVisibleAssistantMessage(m)) {
        if (m.reasoning?.trim()) {
          workItems.push({
            index: i,
            msg: {
              ...m,
              content: "",
              reasoning: m.reasoning,
              reasoningStreaming: m.reasoningStreaming,
              streaming: false,
            },
          });
        }
        if (workItems.length > 0) {
          out.push(makeWorkTrace(workItems, now));
          workItems.length = 0;
        }
        const displayMsg =
          m.reasoning?.trim()
            ? { ...m, reasoning: undefined, reasoningStreaming: false }
            : m;
        out.push({ type: "message", msg: displayMsg, index: i });
        i++;
        break;
      }

      if (isWorkStepMessage(m)) {
        workItems.push({ msg: m, index: i });
        i++;
        continue;
      }

      i++;
    }

    if (workItems.length > 0) {
      out.push(makeWorkTrace(workItems, now));
    }
  }

  return out;
}

export function displayItemKey(item: ChatDisplayItem): string {
  return item.type === "message" ? item.msg.id : item.trace.id;
}

/** Cursor-style compact duration (e.g. `5m 37s`, `12s`). */
export function formatWorkDuration(ms: number): string {
  const totalSec = Math.max(1, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/** Summary line on a collapsed work-trace node (Cursor-style). */
export function formatWorkTraceLabel(trace: UiWorkTrace, now: number = Date.now()): string {
  const end = trace.active ? now : trace.endedAt ?? now;
  const duration = formatWorkDuration(end - trace.startedAt);
  return trace.active ? t("ai.workingFor", { duration }) : t("ai.workedFor", { duration });
}
