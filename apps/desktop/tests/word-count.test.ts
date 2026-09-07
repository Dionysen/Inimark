import { describe, expect, test } from "vitest";

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
