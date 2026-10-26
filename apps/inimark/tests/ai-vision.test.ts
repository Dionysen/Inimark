import { describe, expect, test } from "vitest";

import {
  buildUserApiContent,
  formatHistoryUserContent,
  partitionAttachmentContents,
} from "../src/ai/agent/context.ts";
import { mergeVaultPathAttachments } from "../src/ai/attachments.ts";
import { toOpenAiMessages } from "../src/ai/providers/sse.ts";
import type { ChatMessage } from "../src/ai/types.ts";
import {
  aiVisionImageMime,
  isAiVisionImagePath,
  prefsSupportVision,
  uint8ToBase64,
} from "../src/ai/vision.ts";

describe("vision helpers", () => {
  test("detects supported image extensions", () => {
    expect(isAiVisionImagePath("a/b.png")).toBe(true);
    expect(isAiVisionImagePath("shot.JPEG")).toBe(true);
    expect(isAiVisionImagePath("x.webp")).toBe(true);
    expect(isAiVisionImagePath("note.md")).toBe(false);
    expect(isAiVisionImagePath("icon.svg")).toBe(false);
    expect(aiVisionImageMime("a.PNG")).toBe("image/png");
    expect(aiVisionImageMime("a.jpg")).toBe("image/jpeg");
  });

  test("prefsSupportVision follows catalog flags", () => {
    expect(
      prefsSupportVision({
        providerId: "deepseek",
        modelId: "deepseek-flash",
        customModel: "",
      }),
    ).toBe(true);
    expect(
      prefsSupportVision({
        providerId: "deepseek",
        modelId: "deepseek-v4-pro",
        customModel: "",
      }),
    ).toBe(false);
    expect(
      prefsSupportVision({
        providerId: "custom",
        modelId: "x",
        customModel: "local-vl",
      }),
    ).toBe(true);
  });

  test("uint8ToBase64 encodes bytes", () => {
    expect(uint8ToBase64(new Uint8Array([72, 105]))).toBe(btoa("Hi"));
  });
});

describe("multimodal packing", () => {
  test("partitionAttachmentContents separates images from text", () => {
    const { textItems, images } = partitionAttachmentContents([
      {
        attachment: { id: "1", kind: "file", path: "a.md", label: "a.md" },
        content: "# hi",
      },
      {
        attachment: { id: "2", kind: "image", path: "x.png", label: "x.png" },
        content: "",
        image: { mime: "image/png", base64: "abc" },
      },
    ]);
    expect(textItems).toHaveLength(1);
    expect(images).toEqual([
      { path: "x.png", label: "x.png", mime: "image/png", base64: "abc" },
    ]);
  });

  test("buildUserApiContent returns parts when images exist", () => {
    expect(buildUserApiContent("hello", [])).toBe("hello");
    expect(
      buildUserApiContent("hello", [{ mime: "image/png", base64: "qq" }]),
    ).toEqual([
      { type: "text", text: "hello" },
      { type: "image", mime: "image/png", base64: "qq" },
    ]);
  });

  test("formatHistoryUserContent lists image paths without bytes", () => {
    expect(
      formatHistoryUserContent("ask", [{ path: "a.png", label: "a.png" }]),
    ).toContain("[Attached images]");
    expect(
      formatHistoryUserContent("ask", [{ path: "a.png", label: "a.png" }]),
    ).toContain("a.png");
    expect(
      formatHistoryUserContent("ask", [{ path: "a.png", label: "a.png" }]),
    ).not.toContain("base64");
  });

  test("mergeVaultPathAttachments tags image files", () => {
    const next = mergeVaultPathAttachments(
      [],
      [
        { path: "docs/pic.png", kind: "file" },
        { path: "docs/note.md", kind: "file" },
      ],
      () => "id",
    );
    expect(next.map((a) => a.kind)).toEqual(["image", "file"]);
  });
});

describe("toOpenAiMessages multimodal", () => {
  test("encodes image parts as data URLs", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "what is this?" },
          { type: "image", mime: "image/png", base64: "AAA" },
        ],
      },
    ];
    expect(toOpenAiMessages(messages)).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "what is this?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,AAA" },
          },
        ],
      },
    ]);
  });
});
