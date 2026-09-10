import { describe, expect, test } from "vitest";

import { collectMdMatches } from "../src/find-in-markdown.ts";

describe("collectMdMatches", () => {
  test("finds literal matches case-insensitively by default", () => {
    const matches = collectMdMatches("Hello hello", { query: "hello" });
    expect(matches).toEqual([
      { from: 0, to: 5 },
      { from: 6, to: 11 },
    ]);
  });

  test("respects case sensitivity", () => {
    const matches = collectMdMatches("Hello hello", {
      query: "hello",
      caseSensitive: true,
    });
    expect(matches).toEqual([{ from: 6, to: 11 }]);
  });

  test("whole word skips partial token hits", () => {
    const matches = collectMdMatches("foo foobar foo", {
      query: "foo",
      wholeWord: true,
    });
    expect(matches).toEqual([
      { from: 0, to: 3 },
      { from: 11, to: 14 },
    ]);
  });

  test("regex mode supports patterns", () => {
    const matches = collectMdMatches("a1 b22 c333", {
      query: "\\d+",
      regex: true,
    });
    expect(matches).toEqual([
      { from: 1, to: 2 },
      { from: 4, to: 6 },
      { from: 8, to: 11 },
    ]);
  });

  test("invalid regex returns no matches", () => {
    expect(collectMdMatches("text", { query: "[", regex: true })).toEqual([]);
  });
});
