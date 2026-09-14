import { describe, expect, test } from "vitest";

import {
  fileNameFromPath,
  parentDirFromPath,
} from "../src/platform/env.ts";

describe("parentDirFromPath", () => {
  test("returns the parent folder for nested vault paths", () => {
    expect(parentDirFromPath("docs/zh/02-库/关系图谱.md")).toBe("docs/zh/02-库");
    expect(parentDirFromPath("notes/a.md")).toBe("notes");
  });

  test("returns empty for root-level files", () => {
    expect(parentDirFromPath("Welcome.md")).toBe("");
    expect(parentDirFromPath("")).toBe("");
  });

  test("normalizes backslashes", () => {
    expect(parentDirFromPath("docs\\en\\Welcome.md")).toBe("docs/en");
  });
});

describe("fileNameFromPath", () => {
  test("returns the leaf name", () => {
    expect(fileNameFromPath("docs/zh/关系图谱.md")).toBe("关系图谱.md");
    expect(fileNameFromPath("Welcome.md")).toBe("Welcome.md");
  });
});
