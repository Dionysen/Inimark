import type { GraphMatchMode } from "./match.ts";

export type GraphSuggestKind = GraphMatchMode;

export type GraphSuggestItem = {
  id: string;
  label: string;
  /** Replaces the value field when chosen. */
  insert: string;
  kind: GraphSuggestKind;
  detail?: string;
};

export type GraphSuggestCatalog = {
  tags: readonly string[];
  notes: readonly { name: string; path: string }[];
};

function includesInsensitive(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
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
 * Suggest values for the selected color-group match mode.
 */
export function suggestMatchValue(
  mode: GraphMatchMode,
  partial: string,
  catalog: GraphSuggestCatalog,
  limit = 25,
): GraphSuggestItem[] {
  const needle = partial.trim();

  if (mode === "tag") {
    const q = needle.replace(/^#/, "");
    return catalog.tags
      .filter((tag) => includesInsensitive(tag, q))
      .slice(0, limit)
      .map((tag) => ({
        id: `tag:${tag}`,
        label: tag,
        insert: tag,
        kind: "tag" as const,
      }));
  }

  if (mode === "path") {
    return collectPathSuggestions(catalog.notes)
      .filter((path) => includesInsensitive(path, needle))
      .slice(0, limit)
      .map((path) => ({
        id: `path:${path}`,
        label: path,
        insert: path,
        kind: "path" as const,
      }));
  }

  const seen = new Set<string>();
  const items: GraphSuggestItem[] = [];
  for (const note of catalog.notes) {
    const file = noteFileLabel(note.path, note.name);
    const stem = noteStem(note.path, note.name);
    const candidates = mode === "file" ? [stem, file] : [stem];
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      if (!includesInsensitive(candidate, needle) && !includesInsensitive(note.name, needle)) {
        continue;
      }
      seen.add(key);
      items.push({
        id: `${mode}:${note.path}:${candidate}`,
        label: candidate,
        insert: candidate,
        kind: mode,
        detail: note.path.replace(/\\/g, "/"),
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}
