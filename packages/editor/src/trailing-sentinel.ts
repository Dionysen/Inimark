import { Fragment, type Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";

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

export function trailingSentinelPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      if (!docNeedsTrailingSentinel(newState.doc)) return null;
      const tr = newState.tr;
      const para = schema.nodes.paragraph!.create();
      return tr.insert(tr.doc.content.size, para);
    },
  });
}
