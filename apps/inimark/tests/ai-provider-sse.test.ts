import { describe, expect, test } from "vitest";

import { parseAnthropicSseData } from "../src/ai/providers/anthropic.ts";
import { parseGeminiSsePayload } from "../src/ai/providers/gemini.ts";
import { parseSseDataPayload } from "../src/ai/providers/sse.ts";
import { consumeSseBlocks, parseSseBlock } from "../src/ai/providers/sse-buffer.ts";

describe("OpenAI-compatible SSE", () => {
  test("parses content and reasoning_content", () => {
    const events = parseSseDataPayload(
      JSON.stringify({
        choices: [
          {
            delta: {
              content: "hi",
              reasoning_content: "think",
            },
          },
        ],
      }),
    );
    expect(events).toEqual([
      { type: "reasoning_delta", text: "think" },
      { type: "text_delta", text: "hi" },
    ]);
  });
});

describe("Anthropic SSE", () => {
  test("parses thinking and text deltas", () => {
    const acc = new Map();
    const thinking = parseAnthropicSseData(
      "content_block_delta",
      JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "thinking_delta", thinking: "reason…" },
      }),
      acc,
    );
    expect(thinking).toEqual([{ type: "reasoning_delta", text: "reason…" }]);

    const text = parseAnthropicSseData(
      "content_block_delta",
      JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "answer" },
      }),
      acc,
    );
    expect(text).toEqual([{ type: "text_delta", text: "answer" }]);
  });

  test("consumeSseBlocks splits event frames", () => {
    const raw =
      "event: content_block_delta\ndata: {\"type\":\"content_block_delta\"}\n\n" +
      "event: ping\ndata: {}\n\npartial";
    const { blocks, rest } = consumeSseBlocks(raw);
    expect(blocks).toHaveLength(2);
    expect(parseSseBlock(blocks[0]!).event).toBe("content_block_delta");
    expect(rest).toBe("partial");
  });
});

describe("Gemini SSE", () => {
  test("parses thought vs text parts", () => {
    const events = parseGeminiSsePayload(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: "step", thought: true },
                { text: "done" },
              ],
            },
          },
        ],
      }),
    );
    expect(events).toEqual([
      { type: "reasoning_delta", text: "step" },
      { type: "text_delta", text: "done" },
    ]);
  });

  test("parses functionCall into tool events", () => {
    const events = parseGeminiSsePayload(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: "read_file", args: { path: "a.md" } } }],
            },
          },
        ],
      }),
    );
    expect(events.some((e) => e.type === "tool_call_delta")).toBe(true);
    expect(events.some((e) => e.type === "message_end")).toBe(true);
  });
});
