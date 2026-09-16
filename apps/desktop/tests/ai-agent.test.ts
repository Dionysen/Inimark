import { describe, expect, test } from "vitest";

import { applyUniqueReplace } from "../src/ai/agent/apply-edit.ts";
import {
  formatDirectoryListing,
  formatUserTurnWithAttachments,
  packAttachmentContext,
} from "../src/ai/agent/context.ts";
import { runAgentLoop } from "../src/ai/agent/loop.ts";
import { AGENT_SYSTEM_PROMPT } from "../src/ai/agent/tool-defs.ts";
import { executeAgentTool, type AgentToolHost } from "../src/ai/agent/tools.ts";
import {
  consumeSseBuffer,
  parseSseDataPayload,
} from "../src/ai/providers/sse.ts";
import type { ChatProvider, ChatStreamEvent } from "../src/ai/types.ts";
import {
  formatToolCardSummary,
  isFinalAssistantAnswer,
} from "../src/ai/tool-labels.ts";
import { formatAnswerAge } from "../src/ai/relative-time.ts";
import {
  clampComposerInputHeight,
  COMPOSER_MAX_LINES,
} from "../src/ai/composer.ts";
import { resolveSendAttachments, mergeVaultPathAttachments } from "../src/ai/attachments.ts";
import type { UiChatMessage } from "../src/ai/types.ts";
import { initI18n, setLocale } from "../src/i18n/index.ts";
import {
  hitVaultPathDropTarget,
  registerVaultPathDropTarget,
} from "../src/platform/vault-path-drop.ts";
import {
  ALL_SIDEBAR_TABS,
  DEFAULT_LEFT_SIDEBAR_TABS,
  DEFAULT_RIGHT_SIDEBAR_TABS,
  normalizeSidebarTabLayout,
} from "../src/sidebar/tab-layout.ts";

initI18n("zh-CN");

describe("normalizeSidebarTabLayout with ai", () => {
  test("defaults place ai on the right", () => {
    expect(DEFAULT_RIGHT_SIDEBAR_TABS).toContain("ai");
    expect(DEFAULT_LEFT_SIDEBAR_TABS).not.toContain("ai");
    const layout = normalizeSidebarTabLayout(undefined, undefined);
    expect(layout.right).toEqual(DEFAULT_RIGHT_SIDEBAR_TABS);
    expect([...layout.left, ...layout.right].sort()).toEqual(
      [...ALL_SIDEBAR_TABS].sort(),
    );
  });

  test("fills missing ai tab for legacy layouts", () => {
    const layout = normalizeSidebarTabLayout(["files"], ["outline"]);
    expect([...layout.left, ...layout.right]).toContain("ai");
    expect(new Set([...layout.left, ...layout.right]).size).toBe(
      ALL_SIDEBAR_TABS.length,
    );
  });
});

describe("applyUniqueReplace", () => {
  test("replaces a unique occurrence", () => {
    const result = applyUniqueReplace("hello world", "world", "there");
    expect(result).toEqual({ ok: true, text: "hello there" });
  });

  test("fails when missing or ambiguous", () => {
    expect(applyUniqueReplace("aa", "b", "c").ok).toBe(false);
    expect(applyUniqueReplace("aaa", "a", "b").ok).toBe(false);
  });
});

describe("packAttachmentContext", () => {
  test("truncates under budget", () => {
    const packed = packAttachmentContext(
      [
        {
          attachment: {
            id: "1",
            kind: "file",
            path: "a.md",
            label: "a.md",
          },
          content: "x".repeat(1000),
        },
      ],
      200,
    );
    expect(packed.blocks[0]?.truncated).toBe(true);
    expect(packed.text).toContain("[truncated]");
    expect(packed.text.length).toBeLessThanOrEqual(220);
  });

  test("formats directory listings", () => {
    const text = formatDirectoryListing(
      [
        { name: "a.md", kind: "file", path: "a.md" },
        { name: "dir", kind: "directory", path: "dir" },
      ],
      10,
    );
    expect(text).toContain("file\ta.md");
    expect(text).toContain("dir\tdir");
  });

  test("formatUserTurnWithAttachments puts the user message before attachments", () => {
    const turn = formatUserTurnWithAttachments("hello", "### Active note: a.md\n\nQ?");
    expect(turn.startsWith("User message:\nhello")).toBe(true);
    expect(turn).toContain("background only");
    expect(turn).toContain("### Active note: a.md");
    expect(formatUserTurnWithAttachments("hi", "")).toBe("hi");
  });
});

describe("SSE parsing", () => {
  test("parses text deltas from data lines", () => {
    const events = parseSseDataPayload(
      JSON.stringify({
        choices: [{ delta: { content: "Hi" } }],
      }),
    );
    expect(events).toEqual([{ type: "text_delta", text: "Hi" }]);
  });

  test("consumeSseBuffer keeps partial lines", () => {
    const first = consumeSseBuffer('data: {"choices":[{"delta":{"content":"A"}}]}\n data: {"choi');
    expect(first.events).toHaveLength(1);
    expect(first.rest.startsWith(" data:")).toBe(true);
  });
});

describe("executeAgentTool apply_edit", () => {
  test("writes unique edit and returns undo", async () => {
    const files = new Map<string, string>([["note.md", "alpha beta"]]);
    const host: AgentToolHost = {
      getActiveNote: () => ({ path: "note.md", content: files.get("note.md")! }),
      readFile: async (path) => {
        const text = files.get(path);
        if (text == null) throw new Error("missing");
        return text;
      },
      listDir: async () => [],
      searchVault: async () => [],
      writeFile: async (path, content) => {
        files.set(path, content);
      },
      openNote: async () => {},
    };
    const result = await executeAgentTool(
      "apply_edit",
      JSON.stringify({
        path: "note.md",
        old_string: "beta",
        new_string: "gamma",
      }),
      host,
    );
    expect(result.ok).toBe(true);
    expect(files.get("note.md")).toBe("alpha gamma");
    expect(result.undo).toEqual({ path: "note.md", before: "alpha beta" });
  });
});

describe("AGENT_SYSTEM_PROMPT intent-first", () => {
  test("requires greeting path: summarize then ask, no vault exploration", () => {
    expect(AGENT_SYSTEM_PROMPT).toMatch(/Intent first/i);
    expect(AGENT_SYSTEM_PROMPT).toMatch(/get_active_note at most once/i);
    expect(AGENT_SYSTEM_PROMPT).toMatch(/Do NOT explore the vault/i);
    expect(AGENT_SYSTEM_PROMPT).toMatch(/ask what they want/i);
    expect(AGENT_SYSTEM_PROMPT).toMatch(/not a replacement for their message/i);
  });
});

describe("runAgentLoop", () => {
  test("runs a tool then finishes", async () => {
    const calls: string[] = [];
    let round = 0;
    const provider: ChatProvider = {
      id: "mock",
      async *streamChat(): AsyncIterable<ChatStreamEvent> {
        round += 1;
        if (round === 1) {
          yield {
            type: "tool_call_delta",
            index: 0,
            id: "c1",
            name: "get_active_note",
            argumentsDelta: "{}",
          };
          yield {
            type: "message_end",
            message: {
              role: "assistant",
              content: null,
              toolCalls: [{ id: "c1", name: "get_active_note", arguments: "{}" }],
            },
          };
          return;
        }
        yield { type: "text_delta", text: "Done" };
        yield {
          type: "message_end",
          message: { role: "assistant", content: "Done" },
        };
      },
    };

    const host: AgentToolHost = {
      getActiveNote: () => {
        calls.push("get_active_note");
        return { path: "a.md", content: "# A" };
      },
      readFile: async () => "",
      listDir: async () => [],
      searchVault: async () => [],
      writeFile: async () => {},
      openNote: async () => {},
    };

    const events: string[] = [];
    await runAgentLoop({
      provider,
      model: "mock",
      history: [],
      userContent: "hello",
      host,
      signal: new AbortController().signal,
      onEvent(event) {
        events.push(event.type);
      },
    });

    expect(calls).toEqual(["get_active_note"]);
    expect(events).toContain("tool_start");
    expect(events).toContain("tool_end");
    expect(events).toContain("done");
  });
});

describe("tool labels and copy eligibility", () => {
  test("formats friendly Chinese tool summaries", () => {
    expect(
      formatToolCardSummary({
        id: "1",
        name: "get_active_note",
        argsPreview: "{}",
        status: "done",
      }),
    ).toBe("获取当前文档 · 完成");
  });

  test("isFinalAssistantAnswer picks the last answer of a turn", () => {
    const messages: UiChatMessage[] = [
      { id: "u1", kind: "user", content: "hello" },
      { id: "a1", kind: "assistant", content: "嗨" },
      {
        id: "t1",
        kind: "tool",
        content: "",
        tool: {
          id: "c1",
          name: "get_active_note",
          argsPreview: "{}",
          status: "done",
        },
      },
      { id: "a2", kind: "assistant", content: "这是总结" },
      { id: "u2", kind: "user", content: "继续" },
      { id: "a3", kind: "assistant", content: "下一轮", streaming: true },
    ];
    expect(isFinalAssistantAnswer(messages, 1)).toBe(false);
    expect(isFinalAssistantAnswer(messages, 3)).toBe(true);
    expect(isFinalAssistantAnswer(messages, 5)).toBe(false);
  });
});

describe("formatAnswerAge", () => {
  const now = Date.parse("2026-09-16T12:00:00.000Z");

  test("formats compact Chinese relative ages", () => {
    setLocale("zh-CN");
    expect(formatAnswerAge(now - 5_000, now)).toBe("刚刚");
    expect(formatAnswerAge(now - 90_000, now)).toBe("1 分钟前");
    expect(formatAnswerAge(now - 3_600_000, now)).toBe("1 小时前");
    expect(formatAnswerAge(now - 2 * 86_400_000, now)).toBe("2 天前");
  });

  test("formats compact English relative ages", () => {
    setLocale("en");
    expect(formatAnswerAge(now - 5_000, now)).toBe("just now");
    expect(formatAnswerAge(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatAnswerAge(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatAnswerAge(now - 86_400_000, now)).toBe("1d ago");
    setLocale("zh-CN");
  });
});

describe("clampComposerInputHeight", () => {
  const line = 18;
  const pad = 4;

  test("grows with content up to five lines then scrolls", () => {
    expect(clampComposerInputHeight(line + pad, line, pad)).toEqual({
      height: line + pad,
      scroll: false,
    });
    expect(clampComposerInputHeight(line * 3 + pad, line, pad)).toEqual({
      height: line * 3 + pad,
      scroll: false,
    });
    const capped = clampComposerInputHeight(line * 8 + pad, line, pad);
    expect(capped.height).toBe(line * COMPOSER_MAX_LINES + pad);
    expect(capped.scroll).toBe(true);
  });
});

describe("resolveSendAttachments", () => {
  const labelForPath = (path: string) => path.split("/").pop() || path;
  let n = 0;
  const makeId = () => `id-${++n}`;

  test("silently adds current note when user attached nothing", () => {
    n = 0;
    expect(
      resolveSendAttachments({
        userAttachments: [],
        activeFilePath: "notes/a.md",
        attachActiveNote: true,
        makeId,
        labelForPath,
      }),
    ).toEqual([
      { id: "id-1", kind: "active-note", path: "notes/a.md", label: "a.md" },
    ]);
  });

  test("prefers explicit file/folder chips over silent current note", () => {
    n = 0;
    const file = {
      id: "f1",
      kind: "file" as const,
      path: "other.md",
      label: "other.md",
    };
    expect(
      resolveSendAttachments({
        userAttachments: [file],
        activeFilePath: "notes/a.md",
        attachActiveNote: true,
        makeId,
        labelForPath,
      }),
    ).toEqual([file]);
  });

  test("skips silent current note when pref is off or no active file", () => {
    expect(
      resolveSendAttachments({
        userAttachments: [],
        activeFilePath: "notes/a.md",
        attachActiveNote: false,
        makeId: () => "x",
        labelForPath,
      }),
    ).toEqual([]);
    expect(
      resolveSendAttachments({
        userAttachments: [],
        activeFilePath: null,
        attachActiveNote: true,
        makeId: () => "x",
        labelForPath,
      }),
    ).toEqual([]);
  });
});

describe("mergeVaultPathAttachments", () => {
  test("appends files and folders and dedupes by kind+path", () => {
    let n = 0;
    const existing = [
      { id: "a", kind: "file" as const, path: "a.md", label: "a.md" },
    ];
    const merged = mergeVaultPathAttachments(
      existing,
      [
        { path: "a.md", kind: "file" },
        { path: "docs", kind: "directory" },
        { path: "b.md", kind: "file" },
      ],
      () => `n-${++n}`,
    );
    expect(merged).toEqual([
      { id: "a", kind: "file", path: "a.md", label: "a.md" },
      { id: "n-1", kind: "directory", path: "docs", label: "docs/" },
      { id: "n-2", kind: "file", path: "b.md", label: "b.md" },
    ]);
  });
});

describe("vault path drop targets", () => {
  test("hitVaultPathDropTarget finds the registered host under the pointer", () => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "10px";
    host.style.top = "10px";
    host.style.width = "100px";
    host.style.height = "40px";
    document.body.append(host);
    const drops: string[] = [];
    const unregister = registerVaultPathDropTarget(host, (items) => {
      drops.push(...items.map((i) => i.path));
    });
    // jsdom layout is often 0×0 — stub geometry for the hit test.
    host.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 10,
        right: 110,
        bottom: 50,
        width: 100,
        height: 40,
        x: 10,
        y: 10,
        toJSON() {},
      }) as DOMRect;

    expect(hitVaultPathDropTarget(20, 20)?.element).toBe(host);
    expect(hitVaultPathDropTarget(200, 200)).toBeNull();
    hitVaultPathDropTarget(20, 20)?.onDrop([{ path: "n.md", kind: "file" }]);
    expect(drops).toEqual(["n.md"]);
    unregister();
    host.remove();
  });
});
