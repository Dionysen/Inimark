// Search-match decorations + helpers to reveal a hit from vault search.
// Query lives in plugin state; decorations recompute when the query meta
// changes or the doc is replaced. Cleared automatically on user edits.

import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

export interface SearchRevealOptions {
  query: string;
  /** 1-based markdown/source line from vault search. */
  line?: number;
  /** Trimmed line text from vault search — used to pick the right hit. */
  snippet?: string;
}

export interface SearchMatchRange {
  from: number;
  to: number;
}

const key = new PluginKey<SearchRevealState>("searchReveal");

interface SearchRevealState {
  query: string;
  activeFrom: number;
  activeTo: number;
  decorations: DecorationSet;
}

function emptyState(): SearchRevealState {
  return {
    query: "",
    activeFrom: -1,
    activeTo: -1,
    decorations: DecorationSet.empty,
  };
}

export function collectSearchMatches(doc: PMNode, query: string): SearchMatchRange[] {
  const q = query.trim();
  if (!q) return [];
  const lowerQuery = q.toLowerCase();
  const matches: SearchMatchRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const lower = text.toLowerCase();
    let index = 0;
    while (index < text.length) {
      const found = lower.indexOf(lowerQuery, index);
      if (found < 0) break;
      matches.push({ from: pos + found, to: pos + found + q.length });
      index = found + Math.max(1, q.length);
    }
  });

  return matches;
}

function lineAtPos(doc: PMNode, pos: number): number {
  const safe = Math.max(0, Math.min(pos, doc.content.size));
  const text = doc.textBetween(0, safe, "\n", "\n");
  if (!text) return 1;
  return text.split("\n").length;
}

function contextAround(doc: PMNode, from: number, to: number, pad = 48): string {
  const start = Math.max(0, from - pad);
  const end = Math.min(doc.content.size, to + pad);
  return doc.textBetween(start, end, "\n", "\n").toLowerCase();
}

/** Pick the best match for a vault-search hit (snippet + line hints). */
export function pickSearchMatch(
  doc: PMNode,
  matches: SearchMatchRange[],
  options: SearchRevealOptions,
): SearchMatchRange | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const snippet = options.snippet?.trim().toLowerCase() ?? "";
  const targetLine = options.line;

  let best = matches[0];
  let bestScore = -Infinity;

  for (const match of matches) {
    let score = 0;
    const ctx = contextAround(doc, match.from, match.to);

    if (snippet) {
      // Prefer matches whose local context overlaps the stored line text.
      const needle = snippet.slice(0, Math.min(snippet.length, 64));
      if (needle && ctx.includes(needle)) score += 100;
      else {
        // Partial token overlap (snippet may be normalized differently).
        const tokens = needle.split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
        let hits = 0;
        for (const token of tokens) {
          if (ctx.includes(token)) hits += 1;
        }
        if (tokens.length > 0) score += (hits / tokens.length) * 40;
      }
    }

    if (targetLine != null && targetLine > 0) {
      const line = lineAtPos(doc, match.from);
      const dist = Math.abs(line - targetLine);
      score += Math.max(0, 50 - dist * 4);
    }

    if (score > bestScore) {
      bestScore = score;
      best = match;
    }
  }

  return best;
}

function buildDecorations(
  doc: PMNode,
  query: string,
  activeFrom: number,
  activeTo: number,
): DecorationSet {
  const matches = collectSearchMatches(doc, query);
  if (matches.length === 0) return DecorationSet.empty;

  const decorations = matches.map((match) => {
    const isActive = match.from === activeFrom && match.to === activeTo;
    return Decoration.inline(match.from, match.to, {
      class: isActive ? "tw-search-hit tw-search-hit--active" : "tw-search-hit",
    });
  });
  return DecorationSet.create(doc, decorations);
}

export function searchRevealPlugin(): Plugin<SearchRevealState> {
  return new Plugin<SearchRevealState>({
    key,
    state: {
      init: emptyState,
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(key) as
          | { query?: string; activeFrom?: number; activeTo?: number; clear?: boolean }
          | undefined;

        if (meta?.clear) return emptyState();

        if (meta && typeof meta.query === "string") {
          const query = meta.query.trim();
          if (!query) return emptyState();
          const activeFrom = meta.activeFrom ?? -1;
          const activeTo = meta.activeTo ?? -1;
          return {
            query,
            activeFrom,
            activeTo,
            decorations: buildDecorations(newState.doc, query, activeFrom, activeTo),
          };
        }

        // Drop highlights after the user edits — positions would be stale.
        if (tr.docChanged && prev.query) {
          return emptyState();
        }

        return prev;
      },
    },
    props: {
      decorations(state) {
        return key.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

export function setSearchRevealMeta(
  tr: Transaction,
  options: { query: string; activeFrom: number; activeTo: number } | { clear: true },
): Transaction {
  return tr.setMeta(key, options);
}

export function revealSearchMatchInView(
  view: EditorView,
  options: SearchRevealOptions,
  scrollHost?: HTMLElement | null,
): boolean {
  const query = options.query.trim();
  if (!query) {
    view.dispatch(setSearchRevealMeta(view.state.tr, { clear: true }));
    return false;
  }

  const matches = collectSearchMatches(view.state.doc, query);
  const picked = pickSearchMatch(view.state.doc, matches, options);
  if (!picked) {
    view.dispatch(setSearchRevealMeta(view.state.tr, { clear: true }));
    return false;
  }

  const tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, picked.from, picked.to))
    .scrollIntoView();
  view.dispatch(
    setSearchRevealMeta(tr, {
      query,
      activeFrom: picked.from,
      activeTo: picked.to,
    }),
  );
  view.focus();

  if (scrollHost) {
    try {
      const coords = view.coordsAtPos(picked.from);
      const hostRect = scrollHost.getBoundingClientRect();
      const target = coords.top - hostRect.top + scrollHost.scrollTop - hostRect.height * 0.28;
      scrollHost.scrollTop = Math.max(0, target);
    } catch {
      /* ignore */
    }
  }

  return true;
}

export function clearSearchRevealInView(view: EditorView): void {
  view.dispatch(setSearchRevealMeta(view.state.tr, { clear: true }));
}

export function getSearchRevealState(state: EditorState): SearchRevealState | undefined {
  return key.getState(state);
}
