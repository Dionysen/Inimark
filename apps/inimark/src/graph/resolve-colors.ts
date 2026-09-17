import { parseGraphQuery } from "./query.ts";
import {
  isGraphMatchMode,
  matchColorGroup,
  type GraphMatchMode,
  type NoteMatchContext,
} from "./match.ts";

export type { GraphMatchMode };

/** One ordered color group in graph settings (first match wins). */
export type GraphColorGroup = {
  id: string;
  mode: GraphMatchMode;
  value: string;
  color: string;
  enabled: boolean;
};

/** Map a legacy free-text query (`path:docs tag:inbox`) onto one mode + value. */
export function colorGroupRuleFromQuery(query: string): {
  mode: GraphMatchMode;
  value: string;
} {
  const first = parseGraphQuery(query).terms[0];
  if (!first) return { mode: "tag", value: "" };
  if (first.kind === "path" || first.kind === "file" || first.kind === "tag") {
    return { mode: first.kind, value: first.value };
  }
  if (first.kind === "bare") return { mode: "name", value: first.value };
  return { mode: "tag", value: "" };
}

export function normalizeColorGroupRule(
  rec: Record<string, unknown>,
): { mode: GraphMatchMode; value: string } {
  if (typeof rec.mode === "string" && isGraphMatchMode(rec.mode)) {
    return {
      mode: rec.mode,
      value: typeof rec.value === "string" ? rec.value : "",
    };
  }
  const query = typeof rec.query === "string" ? rec.query : "";
  const migrated = colorGroupRuleFromQuery(query);
  if (typeof rec.value === "string" && rec.value && !migrated.value) {
    return { mode: migrated.mode, value: rec.value };
  }
  return migrated;
}

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
  const active = groups.filter(
    (g) => g.enabled && g.value.trim() && isUsableGraphColor(g.color),
  );
  const out = new Map<string, string>();
  if (active.length === 0) return out;

  for (const path of paths) {
    const ctx = contextFor(path);
    for (const group of active) {
      if (matchColorGroup(ctx, group.mode, group.value)) {
        out.set(path, group.color.trim());
        break;
      }
    }
  }
  return out;
}
