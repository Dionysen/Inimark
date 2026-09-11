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
});
