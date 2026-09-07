import { Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { parse } from "./parser.ts";

const PM_SLICE_RE = /data-pm-slice/i;

function isProseMirrorHtml(html: string): boolean {
  return PM_SLICE_RE.test(html);
}

function normalizePasteText(raw: string): string {
  return raw.replace(/\r\n/g, "\n");
}

/** Insert clipboard markdown at the current selection via the parse pipeline. */
export function insertMarkdownFromText(view: EditorView, raw: string): boolean {
  const text = normalizePasteText(raw);
  if (!text) return false;

  const doc = parse(text);
  if (doc.childCount === 0) return false;

  const slice = doc.slice(0, doc.content.size);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}

/**
 * Route external clipboard markdown through `parse()` so method-B delimiters,
 * block nodes, and inline marks render immediately instead of relying on PM's
 * default HTML-first paste (which drops delimiter text and skips block syntax).
 */
export function markdownPastePlugin(): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const cb = event.clipboardData;
        if (!cb) return false;

        const html = cb.getData("text/html");
        if (html && isProseMirrorHtml(html)) return false;

        const text = cb.getData("text/plain");
        if (!text) return false;

        return insertMarkdownFromText(view, text);
      },

      clipboardTextParser(text) {
        const normalized = normalizePasteText(text);
        if (!normalized) return Slice.empty;
        const doc = parse(normalized);
        if (doc.childCount === 0) return Slice.empty;
        return doc.slice(0, doc.content.size);
      },
    },
  });
}
