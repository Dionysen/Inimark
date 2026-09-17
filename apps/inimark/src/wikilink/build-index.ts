import { collectMarkdownFiles } from "../sidebar/vault-search.ts";
import { readWorkspaceFile } from "../platform/workspace.ts";
import type { Workspace, WorkspaceTreeNode } from "../platform/types.ts";
import { isMarkdownFile } from "../platform/env.ts";
import { linkIndex } from "./link-index.ts";

const CHUNK = 40;

function collectAllFiles(
  nodes: WorkspaceTreeNode[],
  out: { name: string; path: string }[] = [],
): { name: string; path: string }[] {
  for (const node of nodes) {
    if (node.kind === "file") out.push({ name: node.name, path: node.path });
    else if (node.children) collectAllFiles(node.children, out);
  }
  return out;
}

/** Build / refresh the link index for a workspace. */
export async function buildLinkIndexForWorkspace(
  workspace: Workspace,
  options?: { signal?: { cancelled: boolean } },
): Promise<void> {
  const vaultId = workspace.rootPath;
  linkIndex.clear();
  linkIndex.restoreCache(vaultId);

  const allFiles = collectAllFiles(workspace.tree);
  for (const file of allFiles) {
    linkIndex.registerFile(file.path);
  }

  const mdFiles = collectMarkdownFiles(workspace.tree).filter((f) =>
    isMarkdownFile(f.name),
  );

  for (let i = 0; i < mdFiles.length; i += CHUNK) {
    if (options?.signal?.cancelled) return;
    const chunk = mdFiles.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (file) => {
        if (options?.signal?.cancelled) return;
        try {
          const opened = await readWorkspaceFile(workspace, file.path);
          if (opened.status === "opened") {
            linkIndex.addFileLinks(file.path, opened.text);
          }
        } catch {
          /* skip */
        }
      }),
    );
  }

  linkIndex.persistCache(vaultId);
}
