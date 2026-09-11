import { describe, expect, it } from "vitest";
import { renderMarkdownToStaticHtml } from "../src/static-export.ts";

describe("renderMarkdownToStaticHtml", () => {
  it("exports headings and paragraphs", () => {
    const result = renderMarkdownToStaticHtml("# Title\n\nHello **world**.");
    expect(result.html).toContain("<h1");
    expect(result.html).toContain("Title");
    expect(result.outline[0]?.text).toBe("Title");
    expect(result.html).toContain("<p>");
  });

  it("omits yaml front matter from body html", () => {
    const result = renderMarkdownToStaticHtml("---\ntitle: Meta\n---\n\n# Body");
    expect(result.html).not.toContain("yaml-block");
    expect(result.html).not.toContain("title: Meta");
    expect(result.html).toContain("Body");
  });

  it("emits mermaid fences for client-side hydration", () => {
    const result = renderMarkdownToStaticHtml(
      "```mermaid\nflowchart LR\n  A --> B\n```\n",
    );
    expect(result.html).toContain('class="code-block-node has-diagram diagram-pending"');
    expect(result.html).toContain('data-diagram-state="pending"');
    expect(result.html).toContain('<pre class="mermaid">');
    expect(result.html).toContain("flowchart LR");
    expect(result.html).toContain("A --&gt; B");
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
      const result = renderMarkdownToStaticHtml(
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
