import { Fragment, type Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection, type Transaction } from "prosemirror-state";

import { schema } from "./schema.ts";

/** Empty top-level paragraph used as the doc-end editing sentinel. */
export function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === "paragraph" && node.content.size === 0;
}

export function docNeedsTrailingSentinel(doc: PMNode): boolean {
  if (doc.childCount === 0) return true;
  return !isEmptyParagraph(doc.lastChild!);
}

/** Ensure the doc always ends with an empty paragraph for caret placement. */
export function ensureTrailingSentinel(doc: PMNode): PMNode {
  if (!docNeedsTrailingSentinel(doc)) return doc;
  const para = schema.nodes.paragraph!.create();
  return doc.copy(doc.content.addToEnd(para));
}

/** Remove trailing empty paragraphs before save/export (inverse of sentinel). */
export function stripTrailingEmptyParagraphs(doc: PMNode): PMNode {
  let end = doc.childCount;
  while (end > 0 && isEmptyParagraph(doc.child(end - 1)!)) {
    end -= 1;
  }
  if (end === doc.childCount) return doc;
  if (end === 0) return doc.type.create();
  const kept: PMNode[] = [];
  for (let i = 0; i < end; i++) kept.push(doc.child(i));
  return doc.copy(Fragment.from(kept));
}

/** Place the caret at the end of visible content, not in the trailing sentinel. */
export function selectionAtEditableEnd(doc: PMNode): TextSelection {
  if (doc.childCount >= 2 && isEmptyParagraph(doc.lastChild!)) {
    const posBeforeSentinel = doc.content.size - doc.lastChild!.nodeSize;
    const sel = TextSelection.findFrom(doc.resolve(posBeforeSentinel - 1), -1, true);
    if (sel) return sel;
  }
  return TextSelection.atEnd(doc);
}

/** Doc position at the end of visible content (ignores the trailing sentinel). */
export function editableEndPos(doc: PMNode): number {
  return selectionAtEditableEnd(doc).from;
}

/** Place the caret at the start of the trailing sentinel paragraph, if any. */
export function selectionAtSentinelStart(doc: PMNode): TextSelection | null {
  const pos = trailingSentinelStart(doc);
  if (pos == null) return null;
  return TextSelection.create(doc, pos);
}

/** Position at the start of the trailing sentinel paragraph, if present. */
export function trailingSentinelStart(doc: PMNode): number | null {
  if (doc.childCount === 0 || !isEmptyParagraph(doc.lastChild!)) return null;
  let pos = 0;
  for (let i = 0; i < doc.childCount - 1; i++) pos += doc.child(i).nodeSize;
  return pos + 1;
}

/** True when `pos` sits inside the trailing empty sentinel paragraph. */
export function posInTrailingSentinel(doc: PMNode, pos: number): boolean {
  const start = trailingSentinelStart(doc);
  if (start == null) return false;
  const $pos = doc.resolve(pos);
  if ($pos.depth < 1 || $pos.index(0) !== doc.childCount - 1) return false;
  return isEmptyParagraph($pos.node(1));
}

/**
 * Map a position out of the trailing sentinel onto the end of editable content.
 * Empty caret placement in the sentinel is intentional; selection must not use it.
 *
 * Clamps any endpoint at or after the sentinel *node* (not only deep inside it),
 * so ranges that end on the node boundary or at doc end cannot paint the empty line.
 */
export function clampPosAwayFromSentinel(doc: PMNode, pos: number): number {
  const start = trailingSentinelStart(doc);
  if (start == null) return pos;
  // Sentinel node occupies [start - 1, start - 1 + nodeSize).
  if (pos >= start - 1) return editableEndPos(doc);
  return pos;
}

/**
 * Non-empty selections must never include the trailing sentinel — keep the
 * empty caret there for typing, but treat drag/keyboard ranges as ending at
 * the last real content.
 */
function selectionExcludingSentinel(doc: PMNode, selection: TextSelection): TextSelection | null {
  if (selection.empty) return null;
  const anchor = clampPosAwayFromSentinel(doc, selection.anchor);
  const head = clampPosAwayFromSentinel(doc, selection.head);
  if (anchor === selection.anchor && head === selection.head) return null;
  if (anchor === head) return TextSelection.create(doc, anchor);
  return TextSelection.create(doc, anchor, head);
}

export function trailingSentinelPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      let tr: Transaction | null = null;

      if (transactions.some((tx) => tx.docChanged) && docNeedsTrailingSentinel(newState.doc)) {
        tr = newState.tr;
        const para = schema.nodes.paragraph!.create();
        tr.insert(tr.doc.content.size, para);
      }

      const doc = tr?.doc ?? newState.doc;
      const selection = tr?.selection ?? newState.selection;
      if (!(selection instanceof TextSelection)) return tr;

      const next = selectionExcludingSentinel(doc, selection);
      if (!next) return tr;
      tr ??= newState.tr;
      return tr.setSelection(next);
    },
  });
}
