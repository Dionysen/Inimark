import { describe, expect, test } from "vitest";

import {
  collectTagNamesFromMarkdown,
  isValidTagName,
  scanTagsInText,
} from "../../src/tag-parse.ts";
import { runFeatureCases } from "../utils.ts";
import { tagSpecs } from "../../specs/features/tag.specs.ts";

runFeatureCases(tagSpecs);

describe("tag parse helpers", () => {
  test("scanTagsInText finds flat and nested tags", () => {
    expect(scanTagsInText("see #dsa and #foo/bar end")).toEqual([
      { name: "dsa", from: 4, to: 8 },
      { name: "foo/bar", from: 13, to: 21 },
    ]);
  });

  test("rejects glued word characters and heading-like ##", () => {
    expect(scanTagsInText("x#no")).toEqual([]);
    expect(scanTagsInText("## Title")).toEqual([]);
    expect(scanTagsInText("# Title")).toEqual([]);
  });

  test("isValidTagName", () => {
    expect(isValidTagName("dsa")).toBe(true);
    expect(isValidTagName("foo/bar")).toBe(true);
    expect(isValidTagName("工作")).toBe(true);
    expect(isValidTagName("")).toBe(false);
    expect(isValidTagName("#dsa")).toBe(false);
  });

  test("collectTagNamesFromMarkdown skips fenced and inline code", () => {
    const md = [
      "hello #keep",
      "```",
      "#notatag",
      "```",
      "use `#also` and #keep again #other",
    ].join("\n");
    expect(collectTagNamesFromMarkdown(md)).toEqual(["keep", "other"]);
  });
});
