import { describe, expect, it } from "vitest";
import { renderMarkdownToStaticHtml } from "../src/static-export.ts";
import { highlightCodeToHtml } from "../src/code-highlight-html.ts";

describe("renderMarkdownToStaticHtml", () => {
  it("exports headings and paragraphs", async () => {
    const result = await renderMarkdownToStaticHtml("# Title\n\nHello **world**.");
    expect(result.html).toContain("<h1");
    expect(result.html).toContain("Title");
    expect(result.outline[0]?.text).toBe("Title");
    expect(result.html).toContain("<p>");
  });

  it("omits yaml front matter from body html", async () => {
    const result = await renderMarkdownToStaticHtml("---\ntitle: Meta\n---\n\n# Body");
    expect(result.html).not.toContain("yaml-block");
    expect(result.html).not.toContain("title: Meta");
    expect(result.html).toContain("Body");
  });

  it("emits mermaid fences for client-side hydration", async () => {
    const result = await renderMarkdownToStaticHtml(
      "```mermaid\nflowchart LR\n  A --> B\n```\n",
    );
    expect(result.html).toContain('class="code-block-node has-diagram diagram-pending"');
    expect(result.html).toContain('data-diagram-state="pending"');
    expect(result.html).toContain('<pre class="mermaid">');
    expect(result.html).toContain("flowchart LR");
    expect(result.html).toContain("A --&gt; B");
  });

  it("syntax-highlights fenced code at build time", async () => {
    const result = await renderMarkdownToStaticHtml(
      "```python\ndef hello():\n  return 1\n```\n",
    );
    expect(result.html).toContain('data-lang="python"');
    expect(result.html).toContain('class="language-python"');
    expect(result.html).toMatch(/tok-(keyword|function|literal|name)/);
    expect(result.html).toContain("def");
  });

  it("exports the trailing wiki link as a widget, not source chrome", async () => {
    const { setWikiLinkBridge } = await import("../src/wiki-link-bridge.ts");
    setWikiLinkBridge({
      resolveNote: (noteName) => noteName,
      resolveImage: () => null,
      searchNotes: () => [],
      openNote: () => {},
    });
    try {
      const result = await renderMarkdownToStaticHtml(
        "Prev: [[Alpha]] · Next: [[Beta Note]]\n",
        {
          resolveWikiHref: (note) => ({ href: `${note}.html`, unresolved: false }),
        },
      );
      expect(result.html).toContain('data-note="Alpha"');
      expect(result.html).toContain('data-note="Beta Note"');
      expect(result.html).toContain('href="Beta Note.html"');
      expect(result.html).not.toContain("syntax-hint");
      expect(result.html).not.toContain("[[Beta Note]]");
    } finally {
      setWikiLinkBridge(null);
    }
  });
});

describe("highlightCodeToHtml", () => {
  it("wraps python keywords in tok spans", async () => {
    const html = await highlightCodeToHtml("python", "def hello():\n  return 1\n");
    expect(html).toContain("tok-keyword");
    expect(html).toContain("def");
  });

  it("escapes plain text when language is unknown", async () => {
    const html = await highlightCodeToHtml("not-a-real-lang", "a < b");
    expect(html).toBe("a &lt; b");
  });
});
