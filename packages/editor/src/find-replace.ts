// In-document find highlights for rendered (ProseMirror) mode.
// Vault search uses search-reveal.ts; this plugin stays active while the
// find bar is open and refreshes when the document changes.

import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

import type { SearchMatchRange } from "./search-reveal.ts";

export interface FindReplaceViewState {
  active: boolean;
  query: string;
  activeFrom: number;
  activeTo: number;
  decorations: DecorationSet;
}

const key = new PluginKey<FindReplaceViewState>("findReplace");

function emptyState(): FindReplaceViewState {
  return {
    active: false,
    query: "",
    activeFrom: -1,
    activeTo: -1,
    decorations: DecorationSet.empty,
  };
}

function buildDecorations(
  doc: PMNode,
  matches: SearchMatchRange[],
  activeFrom: number,
  activeTo: number,
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  const decorations = matches.map((match) => {
    const isActive = match.from === activeFrom && match.to === activeTo;
    return Decoration.inline(match.from, match.to, {
      class: isActive ? "tw-search-hit tw-search-hit--active" : "tw-search-hit",
    });
  });
  return DecorationSet.create(doc, decorations);
}

export function findReplacePlugin(): Plugin<FindReplaceViewState> {
  return new Plugin<FindReplaceViewState>({
    key,
    state: {
      init: emptyState,
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(key) as
          | {
              active: boolean;
              query: string;
              matches: SearchMatchRange[];
              activeFrom: number;
              activeTo: number;
            }
          | { clear: true }
          | undefined;

        if (meta && "clear" in meta) return emptyState();
        if (meta) {
          return {
            active: meta.active,
            query: meta.query,
            activeFrom: meta.activeFrom,
            activeTo: meta.activeTo,
            decorations: meta.active
              ? buildDecorations(
                  newState.doc,
                  meta.matches,
                  meta.activeFrom,
                  meta.activeTo,
                )
              : DecorationSet.empty,
          };
        }
        // Host re-applies highlights after doc edits while find is open.
        if (tr.docChanged && prev.active) {
          return { ...prev, decorations: DecorationSet.empty };
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

export function setFindReplaceMeta(
  tr: Transaction,
  data: {
    active: boolean;
    query: string;
    matches: SearchMatchRange[];
    activeFrom: number;
    activeTo: number;
  },
): Transaction {
  return tr.setMeta(key, data);
}

export function clearFindReplaceMeta(tr: Transaction): Transaction {
  return tr.setMeta(key, { clear: true });
}

export function applyFindHighlights(
  view: EditorView,
  query: string,
  matches: SearchMatchRange[],
  activeIndex: number,
): void {
  if (!query || matches.length === 0 || activeIndex < 0) {
    view.dispatch(clearFindReplaceMeta(view.state.tr));
    return;
  }
  const active = matches[activeIndex]!;
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, active.from, active.to),
  );
  view.dispatch(
    setFindReplaceMeta(tr, {
      active: true,
      query,
      matches,
      activeFrom: active.from,
      activeTo: active.to,
    }),
  );
}

export function clearFindHighlights(view: EditorView): void {
  view.dispatch(clearFindReplaceMeta(view.state.tr));
}

export function getFindReplaceState(state: EditorState): FindReplaceViewState | undefined {
  return key.getState(state);
}
