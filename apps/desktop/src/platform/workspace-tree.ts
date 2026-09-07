import type { WorkspaceTreeNode } from "./types.ts";

export function fileNameFromRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function parentDirOf(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

export function findWorkspaceTreeNode(
  nodes: WorkspaceTreeNode[],
  path: string,
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findWorkspaceTreeNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function insertWorkspaceTreeNode(
  nodes: WorkspaceTreeNode[],
  parentDir: string,
  node: WorkspaceTreeNode,
): boolean {
  if (!parentDir) {
    nodes.push(node);
    return true;
  }
  const parent = findWorkspaceTreeNode(nodes, parentDir);
  if (!parent || parent.kind !== "directory") return false;
  if (!parent.children) parent.children = [];
  parent.children.push(node);
  return true;
}

export function removeWorkspaceTreeNode(
  nodes: WorkspaceTreeNode[],
  path: string,
): WorkspaceTreeNode | null {
  const idx = nodes.findIndex((n) => n.path === path);
  if (idx >= 0) {
    return nodes.splice(idx, 1)[0] ?? null;
  }
  for (const node of nodes) {
    if (node.children?.length) {
      const removed = removeWorkspaceTreeNode(node.children, path);
      if (removed) return removed;
    }
  }
  return null;
}

export function remapWorkspaceTreeNode(
  node: WorkspaceTreeNode,
  fromPath: string,
  toPath: string,
): WorkspaceTreeNode {
  const newPath =
    node.path === fromPath
      ? toPath
      : `${toPath}${node.path.slice(fromPath.length)}`;
  const newName = fileNameFromRelativePath(newPath);
  if (node.kind === "file") {
    return { ...node, name: newName, path: newPath };
  }
  return {
    ...node,
    name: newName,
    path: newPath,
    children: (node.children ?? []).map((child) =>
      remapWorkspaceTreeNode(child, fromPath, toPath),
    ),
  };
}

export function cloneWorkspaceTreeNode(
  node: WorkspaceTreeNode,
  fromPath: string,
  toPath: string,
): WorkspaceTreeNode {
  return remapWorkspaceTreeNode(structuredClone(node), fromPath, toPath);
}

export function moveWorkspaceTreeNodeInMemory(
  nodes: WorkspaceTreeNode[],
  fromPath: string,
  toPath: string,
): boolean {
  const removed = removeWorkspaceTreeNode(nodes, fromPath);
  if (!removed) return false;
  const remapped = remapWorkspaceTreeNode(removed, fromPath, toPath);
  return insertWorkspaceTreeNode(nodes, parentDirOf(toPath), remapped);
}

export function createFileTreeNode(path: string): WorkspaceTreeNode {
  const now = Date.now();
  return {
    name: fileNameFromRelativePath(path),
    path,
    kind: "file",
    mtimeMs: now,
    birthtimeMs: now,
  };
}

export function createDirectoryTreeNode(path: string): WorkspaceTreeNode {
  const now = Date.now();
  return {
    name: fileNameFromRelativePath(path),
    path,
    kind: "directory",
    children: [],
    mtimeMs: now,
    birthtimeMs: now,
  };
}
