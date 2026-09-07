import { InputRule, wrappingInputRule } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import { Plugin, TextSelection, type Command, type Transaction } from "prosemirror-state";
import { canJoin, findWrapping } from "prosemirror-transform";

import {
  calloutAttrsFromSource,
  convertCurrentBlockquoteCallout,
} from "../callouts.ts";
import type { FeatureSpec } from "./_types.ts";

// Accept ASCII space and IME full-width space (U+3000).
const BLOCKQUOTE_TRIGGER = /^>\s$/;
const BLOCKQUOTE_WRAP_META = "blockquote-wrap";

// Blockquote — no draft concept; input rule commits immediately.
//
// Trigger: at the start of a paragraph, typing `>` then ` ` (space)
// wraps the paragraph into a blockquote. The space is the trigger —
// `>` alone is still plain text, but `> ` IS the blockquote. pretty
// renders a blockquote as `<bq>content</bq>` (multi-block children
// joined by `\n`) — the tag form is what distinguishes a real
// blockquote from a paragraph whose text happens to start with `> `.
//
// Enter behaviour inside a blockquote is fully handled by
// prosemirror-commands' baseKeymap (chainCommands of newlineInCode,
// createParagraphNear, liftEmptyBlock, splitBlock):
//   - non-empty line → splitBlock, new paragraph stays inside blockquote
//   - empty line     → liftEmptyBlock lifts the empty paragraph out of
//                      the blockquote, landing the cursor after it
// So this feature does not contribute a keymap.

const calloutInputRule = new InputRule(
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|DANGER)\]$/i,
  (state, match, start, end) => {
    const attrs = calloutAttrsFromSource(match[1]);
    if (!attrs) return null;

    const $start = state.doc.resolve(start);
    if ($start.parent.type.name !== "paragraph") return null;
    const blockquoteDepth = $start.depth - 1;
    if (blockquoteDepth < 1) return null;
    const blockquote = $start.node(blockquoteDepth);
    if (blockquote.type.name !== "blockquote") return null;
    if ($start.index(blockquoteDepth) !== 0) return null;

    const tr = state.tr.setNodeMarkup($start.before(blockquoteDepth), undefined, {
      ...blockquote.attrs,
      ...attrs,
    });
    const nextChar = $start.parent.textBetween(
      $start.parentOffset + match[0].length - 1,
      $start.parentOffset + match[0].length,
    );
    tr.delete(start, nextChar === "]" ? end + 1 : end);
    return tr.setSelection(TextSelection.create(tr.doc, start));
  },
);

function wrapTriggerParagraph(
  tr: Transaction,
  blockPos: number,
  paragraph: import("prosemirror-model").Node,
  schema: Schema,
): boolean {
  const blockquote = schema.nodes.blockquote;
  if (!blockquote || !BLOCKQUOTE_TRIGGER.test(paragraph.textContent)) return false;

  const textStart = blockPos + 1;
  const textEnd = textStart + paragraph.content.size;
  tr.delete(textStart, textEnd);
  const $start = tr.doc.resolve(textStart);
  const range = $start.blockRange();
  const wrapping = range && findWrapping(range, blockquote);
  if (!wrapping) return false;

  tr.wrap(range, wrapping);
  const before = tr.doc.resolve(textStart - 1).nodeBefore;
  if (before?.type === blockquote && canJoin(tr.doc, textStart - 1)) {
    tr.join(textStart - 1);
  }
  const $cursor = tr.doc.resolve(tr.mapping.map(textStart));
  let depth = $cursor.depth;
  while (depth > 0 && !$cursor.node(depth).isTextblock) depth--;
  tr.setSelection(TextSelection.create(tr.doc, $cursor.start(depth)));
  return true;
}

/** Fallback when DOM edits bypass prosemirror-inputrules (empty line + trailingBreak). */
function blockquoteWrapPlugin(schema: Schema): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((t) => t.docChanged)) return null;
      if (transactions.some((t) => t.getMeta(BLOCKQUOTE_WRAP_META))) return null;

      const triggers: number[] = [];
      newState.doc.forEach((node, offset) => {
        if (node.type.name !== "paragraph") return;
        if (!BLOCKQUOTE_TRIGGER.test(node.textContent)) return;
        if (newState.doc.resolve(offset + 1).depth !== 1) return;
        triggers.push(offset);
      });
      if (triggers.length === 0) return null;

      const tr = newState.tr;
      for (const blockPos of triggers) {
        const node = tr.doc.nodeAt(blockPos);
        if (!node || node.type.name !== "paragraph") continue;
        wrapTriggerParagraph(tr, blockPos, node, schema);
      }
      return tr.setMeta(BLOCKQUOTE_WRAP_META, true);
    },
  });
}

const calloutEnter: Command = (state, dispatch) => {
  if (convertCurrentBlockquoteCallout(state, dispatch)) return true;

  const sel = state.selection;
  if (!sel.empty) return false;
  const $from = sel.$from;
  if ($from.parent.type.name !== "paragraph") return false;
  if ($from.parent.content.size !== 0) return false;

  const blockquoteDepth = $from.depth - 1;
  if (blockquoteDepth < 1) return false;
  const blockquote = $from.node(blockquoteDepth);
  if (blockquote.type.name !== "blockquote" || !blockquote.attrs.alert) return false;
  if ($from.index(blockquoteDepth) !== 0) return false;

  if (dispatch) {
    const insertPos = $from.after();
    const tr = state.tr.insert(insertPos, state.schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
    dispatch(tr);
  }
  return true;
};

export const blockquote: FeatureSpec = {
  name: "blockquote",

  inputRules: (schema) => [
    // Fires when the paragraph text becomes exactly `>` + one whitespace
    // (ASCII or IME full-width). `\s` covers both; the trigger char is space.
    wrappingInputRule(BLOCKQUOTE_TRIGGER, schema.nodes.blockquote),
    calloutInputRule,
  ],

  plugins: (schema) => [blockquoteWrapPlugin(schema)],

  keymap: () => ({ Enter: calloutEnter }),

};
