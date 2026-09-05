import { deleteSelection, setBlockType, wrapIn } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import { TextSelection, type Command } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { wrapInList } from "prosemirror-schema-list";

import { insertMathBlockCommand } from "./features/math.ts";
import { insertTaskListCommand } from "./features/task.ts";
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
  | "wiki-link";

function run(view: EditorView, command: Command): boolean {
  const ok = command(view.state, view.dispatch.bind(view), view);
  if (ok) view.focus();
  return ok;
}

function setHeading(level: number): Command {
  return setBlockType(schema.nodes.heading, { level, style: "atx" });
}

function insertCodeBlock(s: Schema): Command {
  return (state, dispatch) => {
    const node = s.nodes.code_block.create({ lang: "" });
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(node);
      tr.setSelection(TextSelection.create(tr.doc, tr.selection.from - 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
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

function insertTable(s: Schema, rows = 3, cols = 3): Command {
  return (state, dispatch) => {
    const makeRow = (header: boolean) => {
      const cells = [];
      for (let c = 0; c < cols; c++) {
        cells.push(s.nodes.table_cell.create({ header, align: null }));
      }
      return s.nodes.table_row.create(null, cells);
    };
    const rowNodes = [makeRow(true)];
    for (let r = 1; r < rows; r++) rowNodes.push(makeRow(false));
    const table = s.nodes.table.create(null, rowNodes);
    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(table);
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
      return run(view, wrapIn(schema.nodes.blockquote));
    case "list":
      return run(view, wrapInList(schema.nodes.bullet_list));
    case "ordered-list":
      return run(view, wrapInList(schema.nodes.ordered_list));
    case "check":
      return run(view, insertTaskListCommand(schema));
    case "paragraph":
      return run(view, setBlockType(schema.nodes.paragraph));
    case "heading-1":
      return run(view, setHeading(1));
    case "heading-2":
      return run(view, setHeading(2));
    case "heading-3":
      return run(view, setHeading(3));
    case "heading-4":
      return run(view, setHeading(4));
    case "heading-5":
      return run(view, setHeading(5));
    case "heading-6":
      return run(view, setHeading(6));
    case "hr":
      return run(view, insertHorizontalRule(schema));
    case "more":
      return run(view, insertText("<!--more-->"));
    case "table":
      return run(view, insertTable(schema));
    case "code":
      return run(view, insertCodeBlock(schema));
    case "math":
      return run(view, insertMathBlockCommand(schema));
    case "upload":
      return run(view, insertText("![]()"));
    case "wiki-link":
      return run(view, insertText("[["));
    default:
      return false;
  }
}
