export type GraphSuggestKind = "operator" | "tag" | "path" | "file" | "note";

export type GraphSuggestItem = {
  id: string;
  label: string;
  /** Replaces the active token when chosen. */
  insert: string;
  kind: GraphSuggestKind;
  detail?: string;
};

export type GraphSuggestCatalog = {
  tags: readonly string[];
  notes: readonly { name: string; path: string }[];
};

export type GraphSuggestResult = {
  items: GraphSuggestItem[];
  /** Inclusive start / exclusive end of the token being completed. */
  from: number;
  to: number;
};

const OPERATORS: Array<{ op: string; detail: string }> = [
  { op: "path", detail: "Match file path" },
  { op: "file", detail: "Match file name" },
  { op: "tag", detail: "Match tag" },
];

/** Active whitespace-delimited token under the caret. */
export function graphQueryTokenAt(
  query: string,
  caret: number,
): { from: number; to: number; text: string } {
  const pos = Math.max(0, Math.min(caret, query.length));
  let from = pos;
  while (from > 0 && !/\s/.test(query[from - 1]!)) from -= 1;
  let to = pos;
  while (to < query.length && !/\s/.test(query[to]!)) to += 1;
  return { from, to, text: query.slice(from, to) };
}

function includesInsensitive(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function startsInsensitive(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().startsWith(needle.toLowerCase());
}

/** Folder prefixes + full paths from vault notes. */
export function collectPathSuggestions(
  notes: readonly { path: string }[],
): string[] {
  const set = new Set<string>();
  for (const note of notes) {
    const norm = note.path.replace(/\\/g, "/");
    if (!norm) continue;
    set.add(norm);
    const parts = norm.split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
      set.add(acc);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function noteFileLabel(path: string, name: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() || name;
  return base;
}

function noteStem(path: string, name: string): string {
  return noteFileLabel(path, name).replace(/\.(md|markdown|mdown|canvas)$/i, "");
}

/**
 * Obsidian-like suggestions for a graph color-group query.
 * Empty / partial token → operators; `tag:` / `path:` / `file:` → catalog values.
 */
export function suggestGraphQuery(
  query: string,
  caret: number,
  catalog: GraphSuggestCatalog,
  limit = 25,
): GraphSuggestResult {
  const { from, to, text } = graphQueryTokenAt(query, caret);
  const colon = text.indexOf(":");

  if (colon >= 0) {
    const op = text.slice(0, colon).toLowerCase();
    const partial = text.slice(colon + 1);
    if (op === "tag") {
      return {
        from,
        to,
        items: catalog.tags
          .filter((tag) => includesInsensitive(tag, partial.replace(/^#/, "")))
          .slice(0, limit)
          .map((tag) => ({
            id: `tag:${tag}`,
            label: tag,
            insert: `tag:${tag}`,
            kind: "tag" as const,
          })),
      };
    }
    if (op === "path") {
      const paths = collectPathSuggestions(catalog.notes);
      return {
        from,
        to,
        items: paths
          .filter((path) => includesInsensitive(path, partial))
          .slice(0, limit)
          .map((path) => ({
            id: `path:${path}`,
            label: path,
            insert: `path:${path}`,
            kind: "path" as const,
          })),
      };
    }
    if (op === "file") {
      const seen = new Set<string>();
      const items: GraphSuggestItem[] = [];
      for (const note of catalog.notes) {
        const file = noteFileLabel(note.path, note.name);
        const stem = noteStem(note.path, note.name);
        for (const candidate of [stem, file]) {
          if (seen.has(candidate.toLowerCase())) continue;
          if (!includesInsensitive(candidate, partial)) continue;
          seen.add(candidate.toLowerCase());
          items.push({
            id: `file:${candidate}`,
            label: candidate,
            insert: `file:${candidate}`,
            kind: "file",
            detail: note.path.replace(/\\/g, "/"),
          });
          if (items.length >= limit) break;
        }
        if (items.length >= limit) break;
      }
      return { from, to, items };
    }
    // Unknown op — no value suggestions.
    return { from, to, items: [] };
  }

  // No colon yet: operators (and note names if the token is non-empty).
  const items: GraphSuggestItem[] = [];
  for (const { op, detail } of OPERATORS) {
    if (!startsInsensitive(op, text) && !startsInsensitive(`${op}:`, text)) continue;
    items.push({
      id: `op:${op}`,
      label: `${op}:`,
      insert: `${op}:`,
      kind: "operator",
      detail,
    });
  }

  if (text) {
    for (const note of catalog.notes) {
      const stem = noteStem(note.path, note.name);
      if (!includesInsensitive(stem, text) && !includesInsensitive(note.name, text)) {
        continue;
      }
      items.push({
        id: `note:${note.path}`,
        label: stem,
        insert: stem.includes(" ") ? stem : stem,
        kind: "note",
        detail: note.path.replace(/\\/g, "/"),
      });
      if (items.length >= limit) break;
    }
  }

  return { from, to, items: items.slice(0, limit) };
}

/** Replace `[from, to)` with `insert` and return the new caret after the insert. */
export function applyGraphSuggestion(
  query: string,
  from: number,
  to: number,
  insert: string,
): { query: string; caret: number } {
  const next = `${query.slice(0, from)}${insert}${query.slice(to)}`;
  return { query: next, caret: from + insert.length };
}
