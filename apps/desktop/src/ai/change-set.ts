/** Session-scoped AI file edits awaiting Keep / Discard review. */

import { countLineChanges } from "./line-diff.ts";

export interface AiWriteSnapshot {
  path: string;
  before: string;
  after: string;
}

export interface AiFileChange {
  path: string;
  /** Content before the first AI write in this review session. */
  before: string;
  /** Latest AI-written content. */
  after: string;
  added: number;
  removed: number;
}

export interface AiChangeSetTotals {
  files: number;
  added: number;
  removed: number;
}

/**
 * Aggregates AI writes by path for the review bar.
 * Re-writes to the same path keep the original `before` and refresh `after`.
 */
export function createAiChangeSet(): {
  record(snapshot: AiWriteSnapshot): AiFileChange;
  list(): AiFileChange[];
  get(path: string): AiFileChange | undefined;
  remove(path: string): AiFileChange | undefined;
  clear(): void;
  isEmpty(): boolean;
  totals(): AiChangeSetTotals;
} {
  const files = new Map<string, AiFileChange>();
  const order: string[] = [];

  function recount(before: string, after: string): { added: number; removed: number } {
    return countLineChanges(before, after);
  }

  return {
    record(snapshot) {
      const existing = files.get(snapshot.path);
      if (existing) {
        existing.after = snapshot.after;
        const counts = recount(existing.before, existing.after);
        existing.added = counts.added;
        existing.removed = counts.removed;
        const idx = order.indexOf(snapshot.path);
        if (idx >= 0) {
          order.splice(idx, 1);
          order.push(snapshot.path);
        }
        return existing;
      }
      const counts = recount(snapshot.before, snapshot.after);
      const entry: AiFileChange = {
        path: snapshot.path,
        before: snapshot.before,
        after: snapshot.after,
        added: counts.added,
        removed: counts.removed,
      };
      files.set(snapshot.path, entry);
      order.push(snapshot.path);
      return entry;
    },

    list() {
      return order
        .map((path) => files.get(path))
        .filter((entry): entry is AiFileChange => Boolean(entry));
    },

    get(path) {
      return files.get(path);
    },

    remove(path) {
      const entry = files.get(path);
      if (!entry) return undefined;
      files.delete(path);
      const idx = order.indexOf(path);
      if (idx >= 0) order.splice(idx, 1);
      return entry;
    },

    clear() {
      files.clear();
      order.length = 0;
    },

    isEmpty() {
      return files.size === 0;
    },

    totals() {
      let added = 0;
      let removed = 0;
      for (const entry of files.values()) {
        added += entry.added;
        removed += entry.removed;
      }
      return { files: files.size, added, removed };
    },
  };
}

export type AiChangeSet = ReturnType<typeof createAiChangeSet>;
