/** AI chat session model (persisted under `.inimark/ai-chat.json`). */

import type { ChatMessage, UiChatMessage } from "./types.ts";

/** Legacy key used before vault-scoped `.inimark/ai-chat.json`. */
export const AI_CHAT_HISTORY_LEGACY_STORAGE_KEY = "inimark:ai-chat-sessions";

export const AI_CHAT_HISTORY_MAX = 50;
export const AI_CHAT_TITLE_MAX = 40;
export const AI_CHAT_PREVIEW_MAX = 72;

export interface AiChatSession {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  uiMessages: UiChatMessage[];
  history: ChatMessage[];
}

export type AiChatSessionSummary = Pick<
  AiChatSession,
  "id" | "title" | "preview" | "createdAt" | "updatedAt"
>;

function newSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Collapse whitespace and truncate for list titles / previews. */
export function summarizeChatText(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

/**
 * Title from the first user message of a conversation.
 * Generated when the user sends their first message (not after the AI reply).
 */
export function titleFromFirstUserMessage(text: string, emptyFallback: string): string {
  return summarizeChatText(text, AI_CHAT_TITLE_MAX) || emptyFallback;
}

/** Preview prefers the first assistant answer; falls back to the first user text. */
export function previewFromUiMessages(messages: UiChatMessage[]): string {
  const assistant = messages.find(
    (m) => m.kind === "assistant" && (m.content ?? "").trim().length > 0,
  );
  if (assistant?.content) return summarizeChatText(assistant.content, AI_CHAT_PREVIEW_MAX);
  const user = messages.find((m) => m.kind === "user" && (m.content ?? "").trim().length > 0);
  if (user?.content) return summarizeChatText(user.content, AI_CHAT_PREVIEW_MAX);
  return "";
}

export function createAiChatSession(input: {
  title: string;
  uiMessages: UiChatMessage[];
  history: ChatMessage[];
  now?: number;
}): AiChatSession {
  const now = input.now ?? Date.now();
  return {
    id: newSessionId(),
    title: input.title,
    preview: previewFromUiMessages(input.uiMessages),
    createdAt: now,
    updatedAt: now,
    uiMessages: structuredClone(input.uiMessages),
    history: structuredClone(input.history),
  };
}

export function sessionHasContent(session: Pick<AiChatSession, "uiMessages">): boolean {
  return session.uiMessages.some(
    (m) =>
      (m.kind === "user" || m.kind === "assistant" || m.kind === "error") &&
      (m.content ?? "").trim().length > 0,
  );
}

function normalizeSession(raw: unknown): AiChatSession | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== "string" || !rec.id) return null;
  if (typeof rec.title !== "string") return null;
  if (!Array.isArray(rec.uiMessages) || !Array.isArray(rec.history)) return null;
  return {
    id: rec.id,
    title: rec.title,
    preview: typeof rec.preview === "string" ? rec.preview : "",
    createdAt: typeof rec.createdAt === "number" ? rec.createdAt : Date.now(),
    updatedAt: typeof rec.updatedAt === "number" ? rec.updatedAt : Date.now(),
    uiMessages: structuredClone(rec.uiMessages) as UiChatMessage[],
    history: structuredClone(rec.history) as ChatMessage[],
  };
}

/** Parse + normalize a JSON array of sessions (newest first, capped). */
export function parseAiChatSessions(raw: unknown): AiChatSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSession)
    .filter((s): s is AiChatSession => s != null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, AI_CHAT_HISTORY_MAX);
}

/** True when inserting `session` as a new id would drop older entries. */
export function wouldEvictAiChatSession(
  sessions: readonly AiChatSession[],
  session: Pick<AiChatSession, "id">,
  max = AI_CHAT_HISTORY_MAX,
): boolean {
  if (sessions.some((s) => s.id === session.id)) return false;
  return sessions.length >= max;
}

/** Insert or replace a session, bumping it to the front by updatedAt. */
export function upsertAiChatSession(
  sessions: AiChatSession[],
  session: AiChatSession,
): AiChatSession[] {
  const next = sessions.filter((s) => s.id !== session.id);
  next.unshift(session);
  return next
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, AI_CHAT_HISTORY_MAX);
}

export function deleteAiChatSession(
  sessions: AiChatSession[],
  id: string,
): AiChatSession[] {
  return sessions.filter((s) => s.id !== id);
}

/** Read legacy localStorage sessions (for one-time migration into `.inimark`). */
export function loadLegacyAiChatSessionsFromLocalStorage(): AiChatSession[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_HISTORY_LEGACY_STORAGE_KEY);
    if (!raw) return [];
    return parseAiChatSessions(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function clearLegacyAiChatSessionsFromLocalStorage(): void {
  try {
    localStorage.removeItem(AI_CHAT_HISTORY_LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
