import { describe, expect, test } from "vitest";

import {
  collectTagNamesFromMarkdown,
  isValidTagName,
  parseFrontmatterTagNames,
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

  test("requires start of line or whitespace before #", () => {
    expect(scanTagsInText("删除所有的#define")).toEqual([]);
    expect(scanTagsInText("如“#if”和“#endif”")).toEqual([]);
    expect(scanTagsInText("如：#pragma once")).toEqual([]);
    expect(scanTagsInText("#define at line start")).toEqual([
      { name: "define", from: 0, to: 7 },
    ]);
    expect(scanTagsInText("see #include here")).toEqual([
      { name: "include", from: 4, to: 12 },
    ]);
    expect(scanTagsInText("a\n#if b")).toEqual([
      { name: "if", from: 2, to: 5 },
    ]);
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

  test("collectTagNamesFromMarkdown reads YAML flow and block tags", () => {
    const flow = [
      "---",
      "title: glfw APIENTRY",
      "categories: [misc, cpp]",
      "tags: [Windows, GLFW]",
      "comment: true",
      "---",
      "",
      "body #inline",
    ].join("\n");
    expect(collectTagNamesFromMarkdown(flow)).toEqual([
      "Windows",
      "GLFW",
      "inline",
    ]);

    const block = [
      "---",
      "title: Singly Linked list",
      "tags:",
      "  - Programming",
      "  - DataStructure",
      "  - Algorithm",
      "comment: true",
      "---",
      "",
      "see #Algorithm again",
    ].join("\n");
    expect(collectTagNamesFromMarkdown(block)).toEqual([
      "Programming",
      "DataStructure",
      "Algorithm",
    ]);
  });

  test("parseFrontmatterTagNames ignores categories and accepts tag:", () => {
    expect(
      parseFrontmatterTagNames(
        [
          "categories: [经验与技巧与踩坑, cpp]",
          "tag: [Windows, '#GLFW']",
        ].join("\n"),
      ),
    ).toEqual(["Windows", "GLFW"]);
  });
});
