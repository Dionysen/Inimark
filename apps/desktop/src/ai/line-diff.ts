/** Line-level diff helpers for AI change review. */

export type DiffLineKind = "equal" | "add" | "remove";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** 1-based line number in the “before” file (removes / equals). */
  beforeLine?: number;
  /** 1-based line number in the “after” file (adds / equals). */
  afterLine?: number;
}

export interface LineDiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
}

/** Split into lines without dropping a trailing empty line from a final `\n`. */
export function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.split("\n");
}

/**
 * Myers-inspired LCS line diff (O(n·m) time/space).
 * Fine for typical note sizes; very large files get a coarse fallback.
 */
export function diffLines(before: string, after: string): LineDiffResult {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) {
    return { lines: [], added: 0, removed: 0 };
  }

  // Guard pathological sizes (notes are usually small).
  if (n * m > 2_000_000) {
    const lines: DiffLine[] = [];
    let removed = 0;
    let added = 0;
    for (let i = 0; i < n; i++) {
      lines.push({ kind: "remove", text: a[i]!, beforeLine: i + 1 });
      removed++;
    }
    for (let j = 0; j < m; j++) {
      lines.push({ kind: "add", text: b[j]!, afterLine: j + 1 });
      added++;
    }
    return { lines, added, removed };
  }

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  let beforeLine = 1;
  let afterLine = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({
        kind: "equal",
        text: a[i]!,
        beforeLine,
        afterLine,
      });
      i++;
      j++;
      beforeLine++;
      afterLine++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      lines.push({ kind: "remove", text: a[i]!, beforeLine });
      i++;
      beforeLine++;
      removed++;
    } else {
      lines.push({ kind: "add", text: b[j]!, afterLine });
      j++;
      afterLine++;
      added++;
    }
  }
  while (i < n) {
    lines.push({ kind: "remove", text: a[i]!, beforeLine });
    i++;
    beforeLine++;
    removed++;
  }
  while (j < m) {
    lines.push({ kind: "add", text: b[j]!, afterLine });
    j++;
    afterLine++;
    added++;
  }

  return { lines, added, removed };
}

/** Compact +/- counts without building full ops (uses diffLines). */
export function countLineChanges(before: string, after: string): {
  added: number;
  removed: number;
} {
  const { added, removed } = diffLines(before, after);
  return { added, removed };
}
