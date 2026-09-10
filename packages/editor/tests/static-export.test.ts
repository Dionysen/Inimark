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
});
