import type { WorkspaceTreeNode } from "../platform/types.ts";

export type QuickOpenFile = {
  name: string;
  path: string;
};

export function flattenWorkspaceFiles(nodes: WorkspaceTreeNode[]): QuickOpenFile[] {
  const out: QuickOpenFile[] = [];

  function walk(list: WorkspaceTreeNode[]): void {
    for (const node of list) {
      if (node.name.startsWith(".")) continue;
      if (node.kind === "file") {
        out.push({ name: node.name, path: node.path });
      } else if (node.children?.length) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return out;
}

export function matchScore(file: QuickOpenFile, query: string): number {
  const name = file.name.toLowerCase();
  const q = query.toLowerCase();
  const nameWithoutExt = name.replace(/\.[^.]+$/, "");

  if (nameWithoutExt === q) return 100;
  if (nameWithoutExt.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (file.path.toLowerCase().includes(q)) return 40;
  return 0;
}

export function filterQuickOpenFiles(
  files: QuickOpenFile[],
  query: string,
  limit = 50,
): QuickOpenFile[] {
  const q = query.trim();
  if (!q) return [];

  return files
    .map((file) => ({ file, score: matchScore(file, q) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.file.name.localeCompare(b.file.name),
    )
    .slice(0, limit)
    .map(({ file }) => file);
}

export function parentPathOf(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}
