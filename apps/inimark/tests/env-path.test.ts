import { describe, expect, test } from "vitest";

import {
  documentFormatFromPath,
  fileNameFromPath,
  isEditableNoteFile,
  isMarkdownFile,
  isPlainTextFile,
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

describe("document format helpers", () => {
  test("classifies markdown and plaintext by extension", () => {
    expect(documentFormatFromPath("a.md")).toBe("markdown");
    expect(documentFormatFromPath("b.txt")).toBe("plaintext");
    expect(documentFormatFromPath("c.png")).toBeNull();
    expect(isMarkdownFile("a.md")).toBe(true);
    expect(isPlainTextFile("b.txt")).toBe(true);
    expect(isEditableNoteFile("b.txt")).toBe(true);
    expect(isEditableNoteFile("c.png")).toBe(false);
  });
});
