import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection, type Transaction } from "prosemirror-state";

import { schema } from "./schema.ts";

/** Top-level blocks that cannot host a caret after themselves. */
const NEEDS_FOLLOW_PARAGRAPH = new Set([
  "code_block",
  "math_block",
  "html_block",
  "horizontal_rule",
  "more_break",
  "table",
  "toc",
  "front_matter",
]);

function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === "paragraph" && node.content.size === 0;
}

function blockNeedsFollowParagraph(node: PMNode): boolean {
  return NEEDS_FOLLOW_PARAGRAPH.has(node.type.name);
}

/**
 * True when the last top-level block cannot hold a prose caret after itself
 * (fenced code, tables, rules, …). A following empty paragraph is then the
 * only place to type or to land clicks on block chrome.
 */
export function docNeedsEditableEnd(doc: PMNode): boolean {
  if (doc.childCount === 0) return true;
  return blockNeedsFollowParagraph(doc.lastChild!);
}

/** Ensure a document ending in a fence/table/rule still has a place to type. */
export function ensureEditableDocEnd(doc: PMNode): PMNode {
  if (!docNeedsEditableEnd(doc)) return doc;
  const para = schema.nodes.paragraph!.create();
  return doc.copy(doc.content.addToEnd(para));
}

/** Caret at the end of real content, skipping an auto-inserted follow paragraph. */
export function selectionAtContentEnd(doc: PMNode): TextSelection {
  if (
    doc.childCount >= 2 &&
    isEmptyParagraph(doc.lastChild!) &&
    blockNeedsFollowParagraph(doc.child(doc.childCount - 2)!)
  ) {
    const posBefore = doc.content.size - doc.lastChild!.nodeSize;
    const sel = TextSelection.findFrom(doc.resolve(posBefore - 1), -1, true);
    if (sel) return sel;
  }
  return TextSelection.atEnd(doc);
}

export function editableDocEndPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tx) => tx.docChanged)) return null;
      if (!docNeedsEditableEnd(newState.doc)) return null;
      const tr: Transaction = newState.tr;
      tr.insert(tr.doc.content.size, schema.nodes.paragraph!.create());
      return tr;
    },
  });
}
