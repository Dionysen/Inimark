import { setBlockType } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";

import { convertCurrentBlockquoteCallout } from "./callouts.ts";
import {
  toggleBlockquote,
  toggleBulletList,
  toggleCodeBlock,
  toggleHeading,
  toggleMathBlock,
  toggleOrderedList,
  toggleTaskList,
} from "./format-toggle.ts";

function insertHardBreak(schema: Schema): Command {
  return (state, dispatch) => {
    if (convertCurrentBlockquoteCallout(state, dispatch)) return true;
    if (dispatch) {
      const node = schema.nodes.hard_break.create();
      const tr = state.tr.replaceSelectionWith(node).scrollIntoView();
      dispatch(tr);
    }
    return true;
  };
}

export function wrapSelection(open: string, close = open): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const selected = empty ? "" : state.doc.textBetween(from, to, "\n", "\n");
      const tr = state.tr.insertText(`${open}${selected}${close}`, from, to);
      const cursor = empty ? from + open.length : from + open.length + selected.length + close.length;
      tr.setSelection(TextSelection.create(tr.doc, cursor));
      dispatch(tr);
    }
    return true;
  };
}

function insertEmptyLink(): Command {
  return wrapSelection("[", "](url)");
}

export function commonShortcutKeymap(schema: Schema): Record<string, Command> {
  return {
    "Mod-b": wrapSelection("**"),
    "Mod-i": wrapSelection("*"),
    "Mod-u": wrapSelection("<u>", "</u>"),
    "Mod-Shift-`": wrapSelection("`"),
    "Alt-Shift-5": wrapSelection("~~"),
    "Mod-k": insertEmptyLink(),
    "Shift-Enter": insertHardBreak(schema),
    "Mod-0": setBlockType(schema.nodes.paragraph),
    "Mod-1": toggleHeading(schema, 1),
    "Mod-2": toggleHeading(schema, 2),
    "Mod-3": toggleHeading(schema, 3),
    "Mod-4": toggleHeading(schema, 4),
    "Mod-5": toggleHeading(schema, 5),
    "Mod-6": toggleHeading(schema, 6),
    "Alt-Mod-o": toggleOrderedList(schema),
    "Alt-Mod-u": toggleBulletList(schema),
    "Alt-Mod-x": toggleTaskList(schema),
    "Alt-Mod-q": toggleBlockquote(schema),
    "Alt-Mod-c": toggleCodeBlock(schema),
    "Alt-Mod-b": toggleMathBlock(schema),
    "Alt-Mod-r": wrapSelection("[^", "]"),
  };
}
