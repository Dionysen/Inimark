import { collectMarkdownFiles } from "../sidebar/vault-search.ts";
import { readWorkspaceFile } from "../platform/workspace.ts";
import type { Workspace } from "../platform/types.ts";
import { isMarkdownFile } from "../platform/env.ts";
import { tagIndex } from "./tag-index.ts";

const CHUNK = 40;

/** Build / refresh the tag index for a workspace. */
export async function buildTagIndexForWorkspace(
  workspace: Workspace,
  options?: { signal?: { cancelled: boolean } },
): Promise<void> {
  tagIndex.pauseNotifications();
  try {
    tagIndex.clear();

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
              tagIndex.setFileTags(file.path, opened.text);
            }
          } catch {
            /* skip */
          }
        }),
      );
    }
  } finally {
    tagIndex.resumeNotifications();
  }
}
