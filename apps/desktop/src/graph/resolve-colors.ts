import { matchNoteQuery, type NoteMatchContext } from "./match.ts";

/** One ordered color group in graph settings (first match wins). */
export type GraphColorGroup = {
  id: string;
  query: string;
  color: string;
  enabled: boolean;
};

/** Default palette when adding groups or repairing invalid colors. */
export const GRAPH_COLOR_PALETTE = [
  "#e67e22",
  "#3498db",
  "#2ecc71",
  "#9b59b6",
  "#e74c3c",
  "#1abc9c",
  "#f1c40f",
  "#e91e63",
] as const;

const COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^rgba?\(|^hsla?\(|^[a-zA-Z]+$/;

/** True when `color` is a non-empty CSS color string we accept for nodes. */
export function isUsableGraphColor(color: string): boolean {
  const trimmed = color.trim();
  if (!trimmed) return false;
  return COLOR_RE.test(trimmed);
}

export function paletteColorAt(index: number): string {
  const i = ((index % GRAPH_COLOR_PALETTE.length) + GRAPH_COLOR_PALETTE.length) %
    GRAPH_COLOR_PALETTE.length;
  return GRAPH_COLOR_PALETTE[i]!;
}

/**
 * Resolve path → color for enabled groups in order (first match wins).
 * Paths that match no group are omitted from the map.
 */
export function resolveNodeColors(
  paths: readonly string[],
  groups: readonly GraphColorGroup[],
  contextFor: (path: string) => NoteMatchContext,
): Map<string, string> {
  const active = groups.filter((g) => g.enabled && g.query.trim() && isUsableGraphColor(g.color));
  const out = new Map<string, string>();
  if (active.length === 0) return out;

  for (const path of paths) {
    const ctx = contextFor(path);
    for (const group of active) {
      if (matchNoteQuery(ctx, group.query)) {
        out.set(path, group.color.trim());
        break;
      }
    }
  }
  return out;
}
