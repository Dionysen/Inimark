import { describe, expect, test } from "vitest";

import { renderChatMarkdown } from "../src/ai/markdown-render.ts";

describe("renderChatMarkdown task lists", () => {
  test("renders unchecked and checked items as display-only checkboxes", () => {
    const html = renderChatMarkdown(
      "- [ ] 未完成的待办事项\n- [x] 已完成的待办事项\n",
    );

    expect(html).toMatch(/class="[^"]*\binimark-ai-task-list\b/);
    expect(html).toMatch(/class="[^"]*\binimark-ai-task\b/);
    expect(html).toContain('data-checked="0"');
    expect(html).toContain('data-checked="1"');
    expect(html).toContain("未完成的待办事项");
    expect(html).toContain("已完成的待办事项");
    expect(html).not.toMatch(/\[ \]/);
    expect(html).not.toMatch(/\[x\]/i);
  });

  test("leaves ordinary list items unchanged", () => {
    const html = renderChatMarkdown("- plain item\n");
    expect(html).not.toContain("inimark-ai-task");
    expect(html).toContain("plain item");
  });
});

describe("renderChatMarkdown quotes and callouts", () => {
  test("styles plain blockquotes without callout classes", () => {
    const html = renderChatMarkdown("> 这是一段引用。\n> 这是引用的第二行。\n");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("这是一段引用。");
    expect(html).not.toContain("md-alert");
  });

  test("promotes GitHub callout markers into alert blocks", () => {
    const html = renderChatMarkdown(
      [
        "> [!NOTE]",
        "> 这是提示信息。",
        "",
        "> [!TIP]",
        "> 这是小技巧。",
        "",
        "> [!IMPORTANT]",
        "> 这是重要信息。",
        "",
        "> [!WARNING]",
        "> 这是警告信息。",
        "",
        "> [!DANGER]",
        "> 这是危险信息。",
        "",
      ].join("\n"),
    );

    expect(html).toContain('class="md-alert md-alert-note"');
    expect(html).toContain('data-alert="note"');
    expect(html).toContain('class="md-alert md-alert-tip"');
    expect(html).toContain('class="md-alert md-alert-important"');
    expect(html).toContain('class="md-alert md-alert-warning"');
    expect(html).toContain('class="md-alert md-alert-danger"');
    expect(html).toContain("这是提示信息。");
    expect(html).toContain("这是危险信息。");
    expect(html).not.toMatch(/\[!NOTE\]/i);
    expect(html).not.toMatch(/\[!DANGER\]/i);
  });

  test("keeps same-line callout body text after stripping the marker", () => {
    const html = renderChatMarkdown("> [!NOTE] inline body\n");
    expect(html).toContain('data-alert="note"');
    expect(html).toContain("inline body");
    expect(html).not.toMatch(/\[!NOTE\]/i);
  });

  test("maps WARN / CAUTION aliases to warning", () => {
    const warn = renderChatMarkdown("> [!WARN]\n> body\n");
    const caution = renderChatMarkdown("> [!CAUTION]\n> body\n");
    expect(warn).toContain('data-alert="warning"');
    expect(caution).toContain('data-alert="warning"');
  });
});
