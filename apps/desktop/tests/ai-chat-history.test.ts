import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  AI_CHAT_HISTORY_LEGACY_STORAGE_KEY,
  AI_CHAT_HISTORY_MAX,
  clearLegacyAiChatSessionsFromLocalStorage,
  createAiChatSession,
  deleteAiChatSession,
  loadLegacyAiChatSessionsFromLocalStorage,
  parseAiChatSessions,
  previewFromUiMessages,
  sessionHasContent,
  summarizeChatText,
  titleFromFirstUserMessage,
  upsertAiChatSession,
  wouldEvictAiChatSession,
  type AiChatSession,
} from "../src/ai/chat-history.ts";
import type { UiChatMessage } from "../src/ai/types.ts";

function userMsg(content: string, id = "u1"): UiChatMessage {
  return { id, kind: "user", content };
}

function assistantMsg(content: string, id = "a1"): UiChatMessage {
  return { id, kind: "assistant", content };
}

beforeEach(() => {
  localStorage.removeItem(AI_CHAT_HISTORY_LEGACY_STORAGE_KEY);
});

afterEach(() => {
  localStorage.removeItem(AI_CHAT_HISTORY_LEGACY_STORAGE_KEY);
});

describe("titleFromFirstUserMessage", () => {
  test("uses the first user message, collapsed and truncated", () => {
    expect(titleFromFirstUserMessage("  帮我整理\n这篇笔记  ", "新对话")).toBe(
      "帮我整理 这篇笔记",
    );
    const long = "a".repeat(80);
    const title = titleFromFirstUserMessage(long, "新对话");
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(40);
  });

  test("falls back when the first message is empty", () => {
    expect(titleFromFirstUserMessage("   ", "新对话")).toBe("新对话");
  });
});

describe("previewFromUiMessages", () => {
  test("prefers the first assistant reply over the user text", () => {
    expect(
      previewFromUiMessages([
        userMsg("请总结一下"),
        assistantMsg("这篇笔记主要讲本地优先编辑。"),
      ]),
    ).toBe("这篇笔记主要讲本地优先编辑。");
  });

  test("falls back to the first user message when no assistant text yet", () => {
    expect(previewFromUiMessages([userMsg("先记一笔")])).toBe("先记一笔");
  });
});

describe("session list helpers", () => {
  test("parseAiChatSessions normalizes and caps", () => {
    const sessions = parseAiChatSessions([
      {
        id: "old",
        title: "Old",
        uiMessages: [userMsg("a")],
        history: [{ role: "user", content: "a" }],
        updatedAt: 1,
        createdAt: 1,
      },
      {
        id: "new",
        title: "New",
        uiMessages: [userMsg("b")],
        history: [{ role: "user", content: "b" }],
        updatedAt: 9,
        createdAt: 9,
      },
      { id: "bad" },
    ]);
    expect(sessions.map((s) => s.id)).toEqual(["new", "old"]);
  });

  test("create → upsert → wouldEvict at the 50-session cap", () => {
    const session = createAiChatSession({
      title: titleFromFirstUserMessage("整理标签", "新对话"),
      uiMessages: [userMsg("整理标签"), assistantMsg("可以按主题归类。")],
      history: [
        { role: "user", content: "整理标签" },
        { role: "assistant", content: "可以按主题归类。" },
      ],
      now: 1_000,
    });

    expect(session.title).toBe("整理标签");
    expect(session.preview).toBe("可以按主题归类。");
    expect(sessionHasContent(session)).toBe(true);

    let sessions = upsertAiChatSession([], session);
    expect(sessions).toHaveLength(1);

    const filled: AiChatSession[] = [];
    for (let i = 0; i < AI_CHAT_HISTORY_MAX; i++) {
      filled.push(
        createAiChatSession({
          title: `chat-${i}`,
          uiMessages: [userMsg(`msg-${i}`, `u-${i}`)],
          history: [{ role: "user", content: `msg-${i}` }],
          now: i + 1,
        }),
      );
    }
    sessions = [];
    for (const s of filled) sessions = upsertAiChatSession(sessions, s);
    expect(sessions).toHaveLength(AI_CHAT_HISTORY_MAX);
    expect(wouldEvictAiChatSession(sessions, { id: "brand-new" })).toBe(true);
    expect(wouldEvictAiChatSession(sessions, sessions[0]!)).toBe(false);

    const next = createAiChatSession({
      title: "overflow",
      uiMessages: [userMsg("overflow")],
      history: [{ role: "user", content: "overflow" }],
      now: Date.now() + 10_000,
    });
    sessions = upsertAiChatSession(sessions, next);
    expect(sessions).toHaveLength(AI_CHAT_HISTORY_MAX);
    expect(sessions[0]!.title).toBe("overflow");
    expect(sessions.some((s) => s.title === "chat-0")).toBe(false);
  });

  test("delete removes a session; legacy localStorage migrates", () => {
    const a = createAiChatSession({
      title: "A",
      uiMessages: [userMsg("a")],
      history: [{ role: "user", content: "a" }],
      now: 1,
    });
    const b = createAiChatSession({
      title: "B",
      uiMessages: [userMsg("b")],
      history: [{ role: "user", content: "b" }],
      now: 2,
    });
    expect(deleteAiChatSession([b, a], a.id).map((s) => s.id)).toEqual([b.id]);

    localStorage.setItem(
      AI_CHAT_HISTORY_LEGACY_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy",
          title: "Legacy",
          preview: "hi",
          createdAt: 1,
          updatedAt: 2,
          uiMessages: [userMsg("hi")],
          history: [{ role: "user", content: "hi" }],
        },
      ]),
    );
    expect(loadLegacyAiChatSessionsFromLocalStorage()[0]!.id).toBe("legacy");
    clearLegacyAiChatSessionsFromLocalStorage();
    expect(loadLegacyAiChatSessionsFromLocalStorage()).toEqual([]);
  });
});

describe("summarizeChatText", () => {
  test("returns empty for whitespace-only input", () => {
    expect(summarizeChatText(" \n\t ", 40)).toBe("");
  });
});
