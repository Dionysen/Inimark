import { readWorkspaceFile } from "../platform/workspace.ts";
import type { Workspace, WorkspaceTreeNode } from "../platform/types.ts";

export interface VaultSearchMatch {
  line: number;
  content: string;
}

export interface VaultSearchResult {
  path: string;
  fileName: string;
  nameMatch: boolean;
  matches: VaultSearchMatch[];
}

const MAX_RESULTS = 80;
const MAX_MATCHES_PER_FILE = 5;
const MAX_FILE_SIZE = 1024 * 1024;
const CONCURRENCY = 10;

export function collectMarkdownFiles(
  nodes: WorkspaceTreeNode[],
  out: { name: string; path: string }[] = [],
): { name: string; path: string }[] {
  for (const node of nodes) {
    if (node.kind === "file") {
      out.push({ name: node.name, path: node.path });
    } else if (node.children) {
      collectMarkdownFiles(node.children, out);
    }
  }
  return out;
}

function matchLines(text: string, lowerQuery: string): VaultSearchMatch[] {
  if (text.length > MAX_FILE_SIZE) return [];
  const lines = text.split("\n");
  const matches: VaultSearchMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes(lowerQuery)) {
      matches.push({ line: i + 1, content: line.trim() });
      if (matches.length >= MAX_MATCHES_PER_FILE) break;
    }
  }
  return matches;
}

/**
 * Incremental vault search over filenames + markdown content.
 * Calls `onBatch` whenever new file hits are found so the UI can update live.
 */
export async function searchVaultIncremental(
  workspace: Workspace,
  query: string,
  onBatch: (results: VaultSearchResult[]) => void,
  signal: { cancelled: boolean },
): Promise<VaultSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    onBatch([]);
    return [];
  }

  const lowerQuery = trimmed.toLowerCase();
  const files = collectMarkdownFiles(workspace.tree);
  const results: VaultSearchResult[] = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    if (signal.cancelled || results.length >= MAX_RESULTS) break;

    const batch = files.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (file): Promise<VaultSearchResult | null> => {
        if (signal.cancelled) return null;
        const nameMatch = file.name.toLowerCase().includes(lowerQuery);
        let matches: VaultSearchMatch[] = [];
        try {
          const opened = await readWorkspaceFile(workspace, file.path);
          if (opened.status === "opened") {
            matches = matchLines(opened.text, lowerQuery);
          }
        } catch {
          /* skip unreadable files */
        }
        if (!nameMatch && matches.length === 0) return null;
        return {
          path: file.path,
          fileName: file.name,
          nameMatch,
          matches,
        };
      }),
    );

    let changed = false;
    for (const hit of batchResults) {
      if (!hit) continue;
      results.push(hit);
      changed = true;
      if (results.length >= MAX_RESULTS) break;
    }
    if (changed) onBatch([...results]);
  }

  return results;
}

export function highlightMatch(text: string, query: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const q = query.trim();
  if (!q) {
    frag.append(document.createTextNode(text));
    return frag;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx < 0) {
      frag.append(document.createTextNode(text.slice(cursor)));
      break;
    }
    if (idx > cursor) {
      frag.append(document.createTextNode(text.slice(cursor, idx)));
    }
    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + q.length);
    frag.append(mark);
    cursor = idx + q.length;
  }
  return frag;
}
