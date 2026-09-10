import { deleteSelection, setBlockType } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import { TextSelection, type Command } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { insertCallout } from "./callouts.ts";
import { showTableInsertPicker } from "./features/table.ts";
import { insertMoreBreak } from "./features/more-break.ts";
import {
  toggleBlockquote,
  toggleBulletList,
  toggleCodeBlock,
  toggleHeading,
  toggleMathBlock,
  toggleOrderedList,
  toggleTaskList,
} from "./format-toggle.ts";
import { schema } from "./schema.ts";
import { wrapSelection } from "./shortcuts.ts";

export type EditorCommandName =
  | "cut"
  | "copy"
  | "paste"
  | "delete"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "highlight"
  | "link"
  | "quote"
  | "list"
  | "ordered-list"
  | "check"
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "hr"
  | "more"
  | "table"
  | "code"
  | "math"
  | "upload"
  | "wiki-link"
  | "callout-note"
  | "callout-tip"
  | "callout-important"
  | "callout-warning"
  | "callout-danger";

function run(view: EditorView, command: Command): boolean {
  const ok = command(view.state, view.dispatch.bind(view), view);
  if (ok) view.focus();
  return ok;
}

function insertHorizontalRule(s: Schema): Command {
  return (state, dispatch) => {
    const hr = s.nodes.horizontal_rule.create();
    const para = s.nodes.paragraph.create();
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(hr);
      const after = tr.selection.from;
      tr.insert(after, para);
      tr.setSelection(TextSelection.create(tr.doc, after + 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function insertText(text: string): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr.insertText(text);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function insertWikiLink(): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    if (dispatch) {
      const tr = state.tr.insertText("[[]]", from, to);
      tr.setSelection(TextSelection.create(tr.doc, from + 2));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Run a named editing command against a live ProseMirror view. */
export function executeEditorCommand(
  view: EditorView,
  name: EditorCommandName | string,
): boolean {
  switch (name) {
    case "cut":
      return document.execCommand("cut");
    case "copy":
      return document.execCommand("copy");
    case "paste":
      return document.execCommand("paste");
    case "delete":
      return run(view, deleteSelection);
    case "bold":
      return run(view, wrapSelection("**"));
    case "italic":
      return run(view, wrapSelection("*"));
    case "strike":
      return run(view, wrapSelection("~~"));
    case "inline-code":
      return run(view, wrapSelection("`"));
    case "highlight":
      return run(view, wrapSelection("=="));
    case "link":
      return run(view, wrapSelection("[", "](url)"));
    case "quote":
      return run(view, toggleBlockquote(schema));
    case "list":
      return run(view, toggleBulletList(schema));
    case "ordered-list":
      return run(view, toggleOrderedList(schema));
    case "check":
      return run(view, toggleTaskList(schema));
    case "paragraph":
      return run(view, setBlockType(schema.nodes.paragraph));
    case "heading-1":
      return run(view, toggleHeading(schema, 1));
    case "heading-2":
      return run(view, toggleHeading(schema, 2));
    case "heading-3":
      return run(view, toggleHeading(schema, 3));
    case "heading-4":
      return run(view, toggleHeading(schema, 4));
    case "heading-5":
      return run(view, toggleHeading(schema, 5));
    case "heading-6":
      return run(view, toggleHeading(schema, 6));
    case "hr":
      return run(view, insertHorizontalRule(schema));
    case "more":
      return run(view, insertMoreBreak(schema));
    case "table":
      showTableInsertPicker(view);
      return true;
    case "code":
      return run(view, toggleCodeBlock(schema));
    case "math":
      return run(view, toggleMathBlock(schema));
    case "upload":
      return run(view, insertText("![]()"));
    case "wiki-link":
      return run(view, insertWikiLink());
    case "callout-note":
      return run(view, insertCallout("note"));
    case "callout-tip":
      return run(view, insertCallout("tip"));
    case "callout-important":
      return run(view, insertCallout("important"));
    case "callout-warning":
      return run(view, insertCallout("warning"));
    case "callout-danger":
      return run(view, insertCallout("danger"));
    default:
      return false;
  }
}
