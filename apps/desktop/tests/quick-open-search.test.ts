import { describe, expect, test } from "vitest";
import {
  filterQuickOpenFiles,
  flattenWorkspaceFiles,
  matchScore,
  parentPathOf,
} from "../src/quick-open/search.ts";
import type { WorkspaceTreeNode } from "../src/platform/types.ts";

const tree: WorkspaceTreeNode[] = [
  {
    name: "notes",
    path: "notes",
    kind: "directory",
    children: [
      { name: "readme.md", path: "notes/readme.md", kind: "file" },
      { name: "guide.md", path: "notes/guide.md", kind: "file" },
    ],
  },
  { name: "todo.md", path: "todo.md", kind: "file" },
];

describe("flattenWorkspaceFiles", () => {
  test("collects files and skips dotfiles", () => {
    const files = flattenWorkspaceFiles(tree);
    expect(files.map((f) => f.path)).toEqual([
      "notes/readme.md",
      "notes/guide.md",
      "todo.md",
    ]);
  });
});

describe("matchScore", () => {
  const file = { name: "readme.md", path: "notes/readme.md" };

  test("prefers exact name matches", () => {
    expect(matchScore(file, "readme")).toBe(100);
    expect(matchScore(file, "read")).toBe(80);
    expect(matchScore(file, "me.md")).toBe(60);
    expect(matchScore(file, "notes")).toBe(40);
    expect(matchScore(file, "zzz")).toBe(0);
  });
});

describe("filterQuickOpenFiles", () => {
  const files = flattenWorkspaceFiles(tree);

  test("returns ranked matches", () => {
    const matched = filterQuickOpenFiles(files, "read");
    expect(matched[0]?.path).toBe("notes/readme.md");
  });

  test("returns empty for blank query", () => {
    expect(filterQuickOpenFiles(files, "   ")).toEqual([]);
  });
});

describe("parentPathOf", () => {
  test("returns parent directory", () => {
    expect(parentPathOf("notes/readme.md")).toBe("notes");
    expect(parentPathOf("todo.md")).toBe("");
  });
});
