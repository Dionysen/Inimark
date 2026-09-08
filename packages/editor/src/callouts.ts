import type { Node as PMNode } from "prosemirror-model";
import { Plugin, TextSelection, type Command } from "prosemirror-state";

import { caretInsideContainer } from "./selection-utils.ts";

export type CalloutKind =
  | "note"
  | "tip"
  | "important"
  | "warning"
  | "danger";

export type CalloutAttrs = {
  alert: CalloutKind;
  alertSource: string;
};

const CALLOUT_KIND_PATTERN = "NOTE|TIP|IMPORTANT|WARNING|WARN|DANGER|CAUTION";
const CALLOUT_MARKER_RE = new RegExp(
  `^\\[!(${CALLOUT_KIND_PATTERN})\\](?:[ \\t]*(?:\\n|$)|[ \\t]+)`,
  "i",
);
const CALLOUT_MARKER_LINE_RE = new RegExp(
  `^\\[!(${CALLOUT_KIND_PATTERN})\\][ \\t]*$`,
  "i",
);

const CALLOUT_SOURCE_LABEL: Record<CalloutKind, string> = {
  note: "NOTE",
  tip: "TIP",
  important: "IMPORTANT",
  warning: "WARNING",
  danger: "DANGER",
};

export function normalizeCalloutKind(value: string | null | undefined): CalloutKind | null {
  switch ((value ?? "").trim().toLowerCase()) {
    case "note":
      return "note";
    case "tip":
      return "tip";
    case "important":
      return "important";
    case "warning":
    case "warn":
      return "warning";
    case "caution":
      return "warning";
    case "danger":
      return "danger";
    default:
      return null;
  }
}

export function calloutAttrsFromSource(
  value: string | null | undefined,
): CalloutAttrs | null {
  const kind = normalizeCalloutKind(value);
  if (!kind) return null;
  return { alert: kind, alertSource: CALLOUT_SOURCE_LABEL[kind] };
}

export function getCalloutAttrsFromElement(el: HTMLElement): CalloutAttrs | null {
  const dataSource = el.getAttribute("data-alert-source");
  const dataKind = el.getAttribute("data-alert");
  const fromData = calloutAttrsFromSource(dataSource ?? dataKind);
  if (fromData) return fromData;

  for (const cls of Array.from(el.classList)) {
    const match = /^(?:md-alert|md-alert-text|markdown-alert)-(note|tip|important|warning|danger)$/i.exec(
      cls,
    );
    if (!match) continue;
    return calloutAttrsFromSource(match[1]);
  }

  return null;
}

function stripCalloutMarker(paragraph: PMNode): {
  attrs: CalloutAttrs;
  paragraph: PMNode | null;
} | null {
  const first = paragraph.firstChild;
  if (!first?.isText) return null;

  const text = first.text ?? "";
  const match = CALLOUT_MARKER_RE.exec(text);
  if (!match) return null;

  const attrs = calloutAttrsFromSource(match[1]);
  if (!attrs) return null;

  const inline: PMNode[] = [];
  const remaining = text.slice(match[0].length);
  if (remaining) inline.push(paragraph.type.schema.text(remaining, first.marks));

  let dropLeadingBreak = remaining.length === 0;
  paragraph.forEach((child, _offset, index) => {
    if (index === 0) return;
    if (dropLeadingBreak) {
      dropLeadingBreak = false;
      if (child.type.name === "hard_break") return;
      if (child.isText && child.text?.startsWith("\n")) {
        const rest = child.text.slice(1);
        if (rest) inline.push(paragraph.type.schema.text(rest, child.marks));
        return;
      }
    }
    inline.push(child);
  });

  return {
    attrs,
    paragraph:
      inline.length > 0
        ? paragraph.type.createAndFill(paragraph.attrs, inline)
        : null,
  };
}

function foldBlockquote(node: PMNode): PMNode {
  const first = node.firstChild;
  if (!first || first.type.name !== "paragraph") return node;

  const stripped = stripCalloutMarker(first);
  if (!stripped) return node;

  const children: PMNode[] = [];
  if (stripped.paragraph) children.push(stripped.paragraph);
  node.forEach((child, _offset, index) => {
    if (index > 0) children.push(child);
  });
  if (children.length === 0) {
    children.push(node.type.schema.nodes.paragraph.create());
  }

  return node.type.createAndFill(
    { ...node.attrs, ...stripped.attrs },
    children,
  )!;
}

function transformBlock(node: PMNode): PMNode {
  if (node.isInline || node.childCount === 0) return node;

  const children: PMNode[] = [];
  let changed = false;
  node.forEach((child) => {
    const next = transformBlock(child);
    if (next !== child) changed = true;
    children.push(next);
  });

  let current = node;
  if (changed) current = node.type.createAndFill(node.attrs, children, node.marks)!;
  return current.type.name === "blockquote" ? foldBlockquote(current) : current;
}

export function foldMarkdownCallouts(doc: PMNode): PMNode {
  return transformBlock(doc);
}

/** Fold a single blockquote when its first line carries a callout marker. */
export function foldBlockquoteCallout(node: PMNode): PMNode {
  return foldBlockquote(node);
}

const CALLOUT_FOLD_META = "callout-auto-fold";

function stripOrphanCloseBracket(
  tr: import("prosemirror-state").Transaction,
  blockPos: number,
  node: PMNode,
): boolean {
  if (!node.attrs.alert) return false;
  const first = node.firstChild;
  if (first?.type.name !== "paragraph" || first.textContent !== "]") return false;
  const textPos = blockPos + 2;
  tr.delete(textPos, textPos + 1);
  return true;
}

/** Live-edit: turn `> [!TIP]` text inside a plain blockquote into a callout. */
export function calloutAutoFoldPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((t) => t.docChanged)) return null;
      if (transactions.some((t) => t.getMeta(CALLOUT_FOLD_META))) return null;

      const tr = newState.tr;
      let changed = false;
      let caret: number | null = null;
      const selFrom = newState.selection.from;
      const folds: { pos: number; node: PMNode; folded: PMNode; containsSelection: boolean }[] = [];
      newState.doc.descendants((node, pos) => {
        if (node.type.name !== "blockquote") return;
        const folded = foldBlockquote(node);
        if (folded !== node) {
          folds.push({
            pos,
            node,
            folded,
            containsSelection: selFrom >= pos && selFrom <= pos + node.nodeSize,
          });
          return;
        }
        if (stripOrphanCloseBracket(tr, pos, node)) {
          if (selFrom >= pos && selFrom <= pos + node.nodeSize) {
            caret = caretInsideContainer(tr, pos, node, selFrom);
          }
          changed = true;
        }
      });
      for (const fold of folds.sort((a, b) => b.pos - a.pos)) {
        tr.replaceWith(fold.pos, fold.pos + fold.node.nodeSize, fold.folded);
        if (fold.containsSelection) {
          caret = caretInsideContainer(tr, fold.pos, fold.folded, selFrom);
        }
        changed = true;
      }
      if (!changed) return null;
      if (caret !== null) {
        tr.setSelection(TextSelection.create(tr.doc, caret));
      }
      return tr.setMeta(CALLOUT_FOLD_META, true);
    },
  });
}

export const convertCurrentBlockquoteCallout: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty) return false;
  const $from = sel.$from;
  if ($from.parent.type.name !== "paragraph") return false;

  const blockquoteDepth = $from.depth - 1;
  if (blockquoteDepth < 1) return false;
  const blockquote = $from.node(blockquoteDepth);
  if (blockquote.type.name !== "blockquote" || blockquote.attrs.alert) return false;
  if ($from.index(blockquoteDepth) !== 0) return false;

  const text = $from.parent.textContent;
  const match = CALLOUT_MARKER_LINE_RE.exec(text);
  if (!match) return false;
  const attrs = calloutAttrsFromSource(match[1]);
  if (!attrs) return false;

  if (dispatch) {
    const paragraphStart = $from.start();
    const paragraphEnd = $from.end();
    const blockquotePos = $from.before(blockquoteDepth);
    const tr = state.tr.setNodeMarkup(blockquotePos, undefined, {
      ...blockquote.attrs,
      ...attrs,
    });
    tr.delete(paragraphStart, paragraphEnd);
    tr.setSelection(TextSelection.create(tr.doc, paragraphStart));
    dispatch(tr);
  }
  return true;
};
