import { describe, expect, test } from "vitest";

import type { WorkspaceTreeNode } from "../src/platform/types.ts";
import {
  cloneWorkspaceTreeNode,
  createDirectoryTreeNode,
  createFileTreeNode,
  findWorkspaceTreeNode,
  insertWorkspaceTreeNode,
  moveWorkspaceTreeNodeInMemory,
  removeWorkspaceTreeNode,
} from "../src/platform/workspace-tree.ts";

function sampleTree(): WorkspaceTreeNode[] {
  return [
    {
      name: "notes",
      path: "notes",
      kind: "directory",
      children: [
        { name: "a.md", path: "notes/a.md", kind: "file" },
        { name: "b.md", path: "notes/b.md", kind: "file" },
      ],
    },
    { name: "readme.md", path: "readme.md", kind: "file" },
  ];
}

describe("workspace-tree", () => {
  test("inserts file at root and in folder", () => {
    const tree = sampleTree();
    insertWorkspaceTreeNode(tree, "", createFileTreeNode("new.md"));
    expect(findWorkspaceTreeNode(tree, "new.md")?.kind).toBe("file");

    insertWorkspaceTreeNode(tree, "notes", createFileTreeNode("notes/c.md"));
    expect(findWorkspaceTreeNode(tree, "notes/c.md")?.name).toBe("c.md");
  });

  test("removes nested file and folder", () => {
    const tree = sampleTree();
    expect(removeWorkspaceTreeNode(tree, "notes/a.md")?.name).toBe("a.md");
    expect(findWorkspaceTreeNode(tree, "notes/a.md")).toBeNull();

    expect(removeWorkspaceTreeNode(tree, "notes")?.kind).toBe("directory");
    expect(findWorkspaceTreeNode(tree, "notes")).toBeNull();
  });

  test("moves and renames nodes in memory", () => {
    const tree = sampleTree();
    expect(moveWorkspaceTreeNodeInMemory(tree, "notes/a.md", "notes/renamed.md")).toBe(
      true,
    );
    expect(findWorkspaceTreeNode(tree, "notes/renamed.md")?.name).toBe("renamed.md");
    expect(moveWorkspaceTreeNodeInMemory(tree, "missing.md", "x.md")).toBe(false);

    expect(moveWorkspaceTreeNodeInMemory(tree, "notes", "archive")).toBe(true);
    expect(findWorkspaceTreeNode(tree, "archive/renamed.md")?.path).toBe(
      "archive/renamed.md",
    );
  });

  test("clones subtree for copy operations", () => {
    const tree = sampleTree();
    const source = findWorkspaceTreeNode(tree, "notes");
    expect(source).not.toBeNull();
    const cloned = cloneWorkspaceTreeNode(source!, "notes", "notes-copy");
    insertWorkspaceTreeNode(tree, "", cloned);
    expect(findWorkspaceTreeNode(tree, "notes-copy/b.md")?.path).toBe(
      "notes-copy/b.md",
    );
  });

  test("creates directory nodes", () => {
    const tree: WorkspaceTreeNode[] = [];
    insertWorkspaceTreeNode(tree, "", createDirectoryTreeNode("drafts"));
    const dir = findWorkspaceTreeNode(tree, "drafts");
    expect(dir?.kind).toBe("directory");
    expect(dir?.children).toEqual([]);
  });
});
