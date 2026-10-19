import { describe, expect, test } from "vitest";

import {
  buildChatDisplayItems,
  formatWorkDuration,
  isVisibleAssistantMessage,
} from "../src/ai/chat-transcript.ts";
import type { UiChatMessage } from "../src/ai/types.ts";

function msg(partial: UiChatMessage): UiChatMessage {
  return partial;
}

describe("buildChatDisplayItems", () => {
  test("groups tools and reasoning-only assistants before a visible answer", () => {
    const messages: UiChatMessage[] = [
      msg({ id: "u1", kind: "user", content: "hi" }),
      msg({
        id: "a1",
        kind: "assistant",
        content: "",
        reasoning: "plan",
        createdAt: 1000,
      }),
      msg({
        id: "t1",
        kind: "tool",
        content: "",
        createdAt: 2000,
        tool: { id: "tc1", name: "read_file", argsPreview: "{}", status: "done" },
      }),
      msg({
        id: "a2",
        kind: "assistant",
        content: "Done.",
        reasoning: "wrap up",
        createdAt: 5000,
        endedAt: 6000,
      }),
    ];

    const items = buildChatDisplayItems(messages, 7000);
    expect(items.map((it) => it.type)).toEqual(["message", "work", "message"]);

    const work = items[1]!;
    expect(work.type).toBe("work");
    if (work.type === "work") {
      expect(work.trace.items.map((x) => x.msg.id)).toEqual(["a1", "t1", "a2"]);
      expect(work.trace.active).toBe(false);
      expect(work.trace.startedAt).toBe(1000);
    }

    const answer = items[2]!;
    expect(answer.type).toBe("message");
    if (answer.type === "message") {
      expect(answer.msg.content).toBe("Done.");
      expect(answer.msg.reasoning).toBeUndefined();
    }
  });

  test("keeps separate work groups between two visible assistant segments", () => {
    const messages: UiChatMessage[] = [
      msg({ id: "u1", kind: "user", content: "go" }),
      msg({
        id: "t1",
        kind: "tool",
        content: "",
        tool: { id: "tc1", name: "read_file", argsPreview: "{}", status: "done" },
      }),
      msg({ id: "a1", kind: "assistant", content: "First part." }),
      msg({
        id: "t2",
        kind: "tool",
        content: "",
        tool: { id: "tc2", name: "write_file", argsPreview: "{}", status: "done" },
      }),
      msg({ id: "a2", kind: "assistant", content: "Second part." }),
    ];

    const items = buildChatDisplayItems(messages);
    expect(items.map((it) => it.type)).toEqual([
      "message",
      "work",
      "message",
      "work",
      "message",
    ]);
  });
});

describe("formatWorkDuration", () => {
  test("formats seconds and minutes", () => {
    expect(formatWorkDuration(12_000)).toBe("12s");
    expect(formatWorkDuration(337_000)).toBe("5m 37s");
    expect(formatWorkDuration(120_000)).toBe("2m");
  });
});

describe("isVisibleAssistantMessage", () => {
  test("requires non-empty content", () => {
    expect(isVisibleAssistantMessage({ id: "a", kind: "assistant", content: "" })).toBe(false);
    expect(isVisibleAssistantMessage({ id: "a", kind: "assistant", content: "x" })).toBe(true);
  });
});
