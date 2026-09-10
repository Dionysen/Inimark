/** Character-range match in a markdown/source buffer. */
export type MdMatch = { from: number; to: number };

export type FindOptions = {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
};

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch);
}

function isWholeWord(text: string, from: number, to: number): boolean {
  const before = from > 0 ? text[from - 1]! : "";
  const after = to < text.length ? text[to]! : "";
  if (before && isWordChar(before)) return false;
  if (after && isWordChar(after)) return false;
  return true;
}

/** Collect non-overlapping find matches in a markdown string. */
export function collectMdMatches(text: string, options: FindOptions): MdMatch[] {
  const query = options.query;
  if (!query) return [];

  const matches: MdMatch[] = [];

  if (options.regex) {
    let re: RegExp;
    try {
      re = new RegExp(query, options.caseSensitive ? "g" : "gi");
    } catch {
      return [];
    }
    for (const hit of text.matchAll(re)) {
      const from = hit.index ?? -1;
      if (from < 0) continue;
      const raw = hit[0] ?? "";
      const to = from + raw.length;
      if (options.wholeWord && !isWholeWord(text, from, to)) continue;
      matches.push({ from, to });
    }
    return matches;
  }

  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  let index = 0;
  while (index <= haystack.length) {
    const found = haystack.indexOf(needle, index);
    if (found < 0) break;
    const to = found + needle.length;
    if (!options.wholeWord || isWholeWord(text, found, to)) {
      matches.push({ from: found, to });
    }
    index = found + Math.max(1, needle.length);
  }
  return matches;
}
