import { afterEach, describe, expect, test, vi } from "vitest";
import { setWikiLinkBridge } from "@inimark/editor";

import { handleChatLinkClick } from "../src/ai/markdown/link-click.ts";
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

describe("renderChatMarkdown math", () => {
  test("renders block math with KaTeX", () => {
    const html = renderChatMarkdown("$$\nS \\times 2^2 = 4S\n$$\n");
    expect(html).toContain("inimark-ai-math--block");
    expect(html).toContain('data-math-state="success"');
    expect(html).toContain("katex");
    expect(html).not.toContain("$$");
  });

  test("renders inline math with KaTeX", () => {
    const html = renderChatMarkdown("面积为 $4S$ 的圆\n");
    expect(html).toContain("inimark-ai-math--inline");
    expect(html).toContain("katex");
    expect(html).toContain("面积为");
  });
});

describe("renderChatMarkdown mermaid", () => {
  test("emits hydrate placeholders for mermaid fences", () => {
    const html = renderChatMarkdown("```mermaid\ngraph TD\n  A-->B\n```\n");
    expect(html).toContain('class="inimark-ai-mermaid"');
    expect(html).toContain("inimark-ai-mermaid-source");
    expect(html).toContain("graph TD");
  });

  test("leaves ordinary fences as code blocks", () => {
    const html = renderChatMarkdown("```js\nconst x = 1\n```\n");
    expect(html).not.toContain("inimark-ai-mermaid");
    expect(html).toContain('class="inimark-ai-code"');
    expect(html).toContain('data-lang="js"');
    expect(html).toContain("const x = 1");
  });
});

describe("hydrateChatCode", () => {
  test("highlights fenced javascript with tok-* spans", async () => {
    const { hydrateChatCode } = await import("../src/ai/markdown/mermaid.ts");
    const host = document.createElement("div");
    host.innerHTML = renderChatMarkdown("```js\nconst answer = 42;\n```\n");
    await hydrateChatCode(host);
    const pre = host.querySelector("pre.inimark-ai-code");
    expect(pre?.getAttribute("data-highlighted")).toBe("1");
    expect(host.innerHTML).toMatch(/tok-(keyword|literal|name)/);
  });
});

describe("renderChatMarkdown links", () => {
  afterEach(() => {
    setWikiLinkBridge(null);
  });

  test("renders markdown and autolinked URLs as anchors", () => {
    const mdLink = renderChatMarkdown("[Inimark](https://example.com)\n");
    expect(mdLink).toContain('href="https://example.com"');
    expect(mdLink).toContain("Inimark");

    const auto = renderChatMarkdown("见 https://example.com/docs 文档\n");
    expect(auto).toContain('href="https://example.com/docs"');
  });

  test("renders wiki links with note metadata", () => {
    const html = renderChatMarkdown("参见 [[安装与启动#macOS|安装指南]]\n");
    expect(html).toContain("inimark-ai-wiki");
    expect(html).toContain('data-note="安装与启动"');
    expect(html).toContain('data-heading="macOS"');
    expect(html).toContain("安装指南");
    expect(html).not.toContain("[[");
  });

  test("marks unresolved wiki links when the vault bridge is absent", () => {
    const html = renderChatMarkdown("打开 [[不存在的笔记]]\n");
    expect(html).toContain("is-unresolved");
    expect(html).toContain('data-unresolved="1"');
    expect(html).toContain('data-note="不存在的笔记"');
  });

  test("resolves wiki links when the vault bridge finds the note", () => {
    setWikiLinkBridge({
      resolveNote: (name) => (name === "安装与启动" ? "docs/安装与启动.md" : null),
      resolveImage: () => null,
      searchNotes: () => [],
      openNote: () => {},
    });
    const html = renderChatMarkdown("打开 [[安装与启动]]\n");
    expect(html).toContain("inimark-ai-wiki");
    expect(html).not.toContain("is-unresolved");
    expect(html).not.toContain("data-unresolved");
  });
});

describe("handleChatLinkClick", () => {
  afterEach(() => {
    setWikiLinkBridge(null);
    document.body.replaceChildren();
  });

  test("opens wiki notes through the bridge", () => {
    const openNote = vi.fn();
    setWikiLinkBridge({
      resolveNote: () => "a.md",
      resolveImage: () => null,
      searchNotes: () => [],
      openNote,
    });
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    bubble.innerHTML = renderChatMarkdown("见 [[目标笔记#标题]]\n");
    document.body.append(bubble);
    const anchor = bubble.querySelector("a.inimark-ai-wiki");
    expect(anchor).toBeTruthy();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: anchor });
    expect(handleChatLinkClick(event)).toBe(true);
    expect(openNote).toHaveBeenCalledWith("目标笔记", "标题");
  });
});
