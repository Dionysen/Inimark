// Temporary heading highlight used by outline / TOC navigation.

import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

const key = new PluginKey<DecorationSet>("headingFlash");

const FLASH_MS = 1000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function headingFlashPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, prev) {
        const meta = tr.getMeta(key) as
          | { from: number; to: number }
          | { clear: true }
          | undefined;
        if (meta && "clear" in meta && meta.clear) return DecorationSet.empty;
        if (meta && "from" in meta) {
          return DecorationSet.create(tr.doc, [
            Decoration.node(meta.from, meta.to, { class: "tw-heading-flash" }),
          ]);
        }
        if (tr.docChanged) return DecorationSet.empty;
        return prev;
      },
    },
    props: {
      decorations(state: EditorState) {
        return key.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

/** Highlight a heading node for ~1s, then clear. */
export function flashHeadingAtPos(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "heading") return;
  const from = pos;
  const to = pos + node.nodeSize;
  if (clearTimer != null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  view.dispatch(view.state.tr.setMeta(key, { from, to }));
  clearTimer = setTimeout(() => {
    clearTimer = null;
    try {
      view.dispatch(view.state.tr.setMeta(key, { clear: true }));
    } catch {
      /* view destroyed */
    }
  }, FLASH_MS);
}
