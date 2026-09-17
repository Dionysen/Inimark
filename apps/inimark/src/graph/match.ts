import { parseGraphQuery, type GraphQuery, type GraphQueryTerm } from "./query.ts";

/** Metadata needed to evaluate a graph color query against one note. */
export type NoteMatchContext = {
  /** Vault-relative path with `/` separators. */
  path: string;
  /** Basename including extension. */
  fileName: string;
  /** Basename without markdown/canvas extension. */
  noteName: string;
  tags: readonly string[];
};

function includesInsensitive(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Obsidian-like nested tags: `tag:a` matches `a` and `a/b`. */
function tagMatches(tags: readonly string[], rawQuery: string): boolean {
  const needle = rawQuery.replace(/^#/, "").trim().toLowerCase();
  if (!needle) return false;
  for (const tag of tags) {
    const t = tag.replace(/^#/, "").toLowerCase();
    if (t === needle || t.startsWith(`${needle}/`)) return true;
  }
  return false;
}

function matchTerm(ctx: NoteMatchContext, term: GraphQueryTerm): boolean {
  switch (term.kind) {
    case "path":
      return includesInsensitive(ctx.path, term.value);
    case "file":
      return (
        includesInsensitive(ctx.fileName, term.value) ||
        includesInsensitive(ctx.noteName, term.value)
      );
    case "tag":
      return tagMatches(ctx.tags, term.value);
    case "bare":
      return (
        includesInsensitive(ctx.noteName, term.value) ||
        includesInsensitive(ctx.fileName, term.value)
      );
    case "unknown":
      // line: / section: / [property] — reserved; never match until indexes exist.
      return false;
  }
}

/** True when every term matches. Empty queries never match. */
export function matchNoteQuery(ctx: NoteMatchContext, query: string | GraphQuery): boolean {
  const parsed = typeof query === "string" ? parseGraphQuery(query) : query;
  if (parsed.terms.length === 0) return false;
  return parsed.terms.every((term) => matchTerm(ctx, term));
}

export const GRAPH_MATCH_MODES = ["path", "file", "tag", "name"] as const;
export type GraphMatchMode = (typeof GRAPH_MATCH_MODES)[number];

export function isGraphMatchMode(value: string): value is GraphMatchMode {
  return (GRAPH_MATCH_MODES as readonly string[]).includes(value);
}

/** Single color-group rule: one match mode and one value. */
export function matchColorGroup(
  ctx: NoteMatchContext,
  mode: GraphMatchMode,
  value: string,
): boolean {
  return matchTerm(ctx, termFromMode(mode, value));
}

function termFromMode(mode: GraphMatchMode, value: string): GraphQueryTerm {
  if (mode === "name") return { kind: "bare", value };
  return { kind: mode, value };
}

const NOTE_EXT = /\.(md|markdown|mdown|canvas)$/i;

/** Build a match context from a vault path and its tags. */
export function noteMatchContextFromPath(
  filePath: string,
  tags: readonly string[] = [],
): NoteMatchContext {
  const path = filePath.replace(/\\/g, "/");
  const slash = path.lastIndexOf("/");
  const fileName = slash >= 0 ? path.slice(slash + 1) : path;
  const noteName = fileName.replace(NOTE_EXT, "");
  return { path, fileName, noteName, tags };
}
