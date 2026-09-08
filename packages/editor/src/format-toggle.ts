import { setBlockType, wrapIn } from "prosemirror-commands";
import type { Node as PMNode, NodeType, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { liftListItem, wrapInList } from "prosemirror-schema-list";

import { insertCodeBlockTransaction } from "./features/fenced-code.ts";
import { insertMathBlockCommand } from "./features/math.ts";
import { insertTaskListCommand } from "./features/task.ts";

function isTextblockEmpty(node: PMNode): boolean {
  if (!node.isTextblock) return false;
  let text = "";
  node.forEach((child) => {
    if (child.isText) text += child.text;
  });
  return text.length === 0;
}

function hasTaskMarker(paragraph: PMNode): boolean {
  return paragraph.firstChild?.type.name === "task_marker";
}

function isMarkerOnlyTaskListItem(li: PMNode): boolean {
  const para = li.firstChild;
  if (!para || para.type.name !== "paragraph") return false;
  if (!hasTaskMarker(para)) return false;
  return isTextblockEmpty(para);
}

function replaceWithParagraph(
  state: import("prosemirror-state").EditorState,
  dispatch: (tr: import("prosemirror-state").Transaction) => void,
  pos: number,
  nodeSize: number,
): boolean {
  const para =
    state.schema.nodes.paragraph.createAndFill() ??
    state.schema.nodes.paragraph.create();
  const tr = state.tr.replaceWith(pos, pos + nodeSize, para);
  tr.setSelection(TextSelection.create(tr.doc, pos + 1));
  dispatch(tr.scrollIntoView());
  return true;
}

function liftEmptyListIn(
  schema: Schema,
  listType: NodeType,
  rejectTaskItems: boolean,
): Command {
  return (state, dispatch, view) => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name !== listType.name) continue;
      const liDepth = d + 1;
      if ($from.depth < liDepth) return false;
      const li = $from.node(liDepth);
      if (li.type.name !== "list_item") return false;
      const para = li.firstChild;
      if (!para || para.type.name !== "paragraph") return false;
      if (rejectTaskItems && hasTaskMarker(para)) return false;
      if (!isTextblockEmpty(para)) return false;
      return liftListItem(schema.nodes.list_item)(state, dispatch, view);
    }
    return false;
  };
}

function liftEmptyTaskListItem(schema: Schema): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name !== "bullet_list") continue;
      const liDepth = d + 1;
      if ($from.depth < liDepth) return false;
      const li = $from.node(liDepth);
      if (!isMarkerOnlyTaskListItem(li)) return false;
      const list = $from.node(d);
      const listPos = $from.before(d);
      if (!dispatch) return true;
      if (list.childCount === 1) {
        return replaceWithParagraph(state, dispatch, listPos, list.nodeSize);
      }
      const liPos = $from.before(liDepth);
      const para = schema.nodes.paragraph.create();
      const tr = state.tr.replaceWith(liPos, liPos + li.nodeSize, para);
      tr.setSelection(TextSelection.create(tr.doc, liPos + 1));
      dispatch(tr.scrollIntoView());
      return true;
    }
    return false;
  };
}

function liftEmptyBlockquote(schema: Schema): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name !== "blockquote") continue;
      const bq = $from.node(d);
      if (bq.childCount !== 1) return false;
      const only = bq.firstChild;
      if (!only || only.type.name !== "paragraph" || !isTextblockEmpty(only)) {
        return false;
      }
      if (!dispatch) return true;
      return replaceWithParagraph(state, dispatch, $from.before(d), bq.nodeSize);
    }
    return false;
  };
}

function liftEmptyCodeBlock(schema: Schema): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    if ($from.parent.type.name !== "code_block") return false;
    if ($from.parent.content.size > 0) return false;
    if (!dispatch) return true;
    const pos = $from.before();
    return replaceWithParagraph(state, dispatch, pos, $from.parent.nodeSize);
  };
}

function liftEmptyMathBlock(schema: Schema): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    if ($from.parent.type.name !== "math_block") return false;
    if ($from.parent.content.size > 0) return false;
    if (!dispatch) return true;
    const pos = $from.before();
    return replaceWithParagraph(state, dispatch, pos, $from.parent.nodeSize);
  };
}

function liftEmptyHeading(schema: Schema, level: number): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    const para = $from.parent;
    if (para.type.name !== "heading") return false;
    if (para.attrs.level !== level) return false;
    if (!isTextblockEmpty(para)) return false;
    if (!dispatch) return true;
    const pos = $from.before();
    const tr = state.tr.setBlockType(pos, pos + para.nodeSize, schema.nodes.paragraph);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

function chainToggle(off: Command, on: Command): Command {
  return (state, dispatch, view) => {
    if (off(state, dispatch, view)) return true;
    return on(state, dispatch, view);
  };
}

export function toggleHeading(schema: Schema, level: number): Command {
  return chainToggle(
    liftEmptyHeading(schema, level),
    setBlockType(schema.nodes.heading, { level, style: "atx" }),
  );
}

export function toggleBlockquote(schema: Schema): Command {
  return chainToggle(
    liftEmptyBlockquote(schema),
    wrapIn(schema.nodes.blockquote),
  );
}

export function toggleBulletList(schema: Schema): Command {
  return chainToggle(
    liftEmptyListIn(schema, schema.nodes.bullet_list, true),
    wrapInList(schema.nodes.bullet_list),
  );
}

export function toggleOrderedList(schema: Schema): Command {
  return chainToggle(
    liftEmptyListIn(schema, schema.nodes.ordered_list, true),
    wrapInList(schema.nodes.ordered_list),
  );
}

export function toggleTaskList(schema: Schema): Command {
  return chainToggle(liftEmptyTaskListItem(schema), insertTaskListCommand(schema));
}

export function toggleCodeBlock(schema: Schema): Command {
  return (state, dispatch) => {
    if (liftEmptyCodeBlock(schema)(state, dispatch)) return true;
    if (dispatch) dispatch(insertCodeBlockTransaction(state, schema));
    return true;
  };
}

export function toggleMathBlock(schema: Schema): Command {
  return chainToggle(liftEmptyMathBlock(schema), insertMathBlockCommand(schema));
}
