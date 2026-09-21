import { describe, expect, test } from "vitest";
import { typewriterIcon } from "@dionysen/ui";

import { stripMarkdownForCount } from "../src/editor/word-count.ts";

describe("stripMarkdownForCount", () => {
  test("removes common markdown syntax", () => {
    const md = "# Title\n\n**bold** and `code` with [link](https://x.test)";
    expect(stripMarkdownForCount(md)).toBe("Title\n\nbold and code with link");
  });

  test("unwraps wiki links", () => {
    expect(stripMarkdownForCount("See [[Note|alias]] here")).toBe("See Note here");
  });
});

describe("typewriter icon", () => {
  test("includes the paper, keyboard, and space bar of a typewriter", () => {
    expect(typewriterIcon).toContain('data-icon="typewriter"');
    expect(typewriterIcon).toContain('d="M8 10V4h8v6"');
    expect(typewriterIcon).toContain('d="M8 17h8"');
  });
});
