/** One term in a graph color-group query (space-separated AND). */
export type GraphQueryTerm =
  | { kind: "path"; value: string }
  | { kind: "file"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "bare"; value: string }
  /** Recognized but unsupported in MVP — never matches. */
  | { kind: "unknown"; op: string; value: string };

export type GraphQuery = {
  /** Original trimmed query string. */
  raw: string;
  terms: GraphQueryTerm[];
};

const KNOWN_OPS = new Set(["path", "file", "tag"]);

/**
 * Parse a graph color-group query into AND terms.
 * Tokens are whitespace-separated. `op:value` uses the first colon;
 * `[…]` is treated as an unknown property operator.
 */
export function parseGraphQuery(query: string): GraphQuery {
  const raw = query.trim();
  if (!raw) return { raw: "", terms: [] };

  const terms: GraphQueryTerm[] = [];
  for (const token of raw.split(/\s+/)) {
    if (!token) continue;

    if (token.startsWith("[") && token.endsWith("]") && token.length >= 2) {
      terms.push({ kind: "unknown", op: "property", value: token.slice(1, -1) });
      continue;
    }

    const colon = token.indexOf(":");
    if (colon > 0) {
      const op = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1);
      if (KNOWN_OPS.has(op)) {
        if (op === "path") terms.push({ kind: "path", value });
        else if (op === "file") terms.push({ kind: "file", value });
        else terms.push({ kind: "tag", value });
        continue;
      }
      terms.push({ kind: "unknown", op, value });
      continue;
    }

    terms.push({ kind: "bare", value: token });
  }

  return { raw, terms };
}
