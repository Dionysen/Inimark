import assert from "node:assert/strict";
import { it } from "node:test";
import { Window } from "happy-dom";
import { mountEditorEmptyState } from "./empty-state.ts";

it("shows a themed mark instead of an editable blank article and restores real articles", () => {
  const window = new Window();
  Object.assign(globalThis, { document: window.document });
  const column = document.createElement("div");
  const host = document.createElement("div");
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  host.append(editor);
  column.append(host);
  document.body.append(column);
  const state = mountEditorEmptyState(column, host, editor,
    '<svg><defs></defs><rect fill="black"/><path fill="white" d="M0 0h10v10z"/></svg>', "请打开文章");
  assert.equal(host.hidden, true);
  assert.equal(host.inert, true);
  assert.equal(editor.contentEditable, "false");
  assert.equal(column.querySelector("[role=status]")?.textContent, "请打开文章");
  assert.equal(column.querySelector("rect"), null);
  assert.equal(column.querySelector("path")?.getAttribute("fill"), "currentColor");
  assert.equal(editor.textContent, "");
  state.setOpen(true);
  assert.equal(host.hidden, false);
  assert.equal(host.inert, false);
  assert.equal(editor.contentEditable, "true");
  assert.equal(column.querySelector<HTMLElement>(".vellum-editor-empty")?.hidden, true);
  state.setOpen(false);
  state.setMessage("Open an article");
  assert.equal(host.hidden, true);
  assert.equal(column.querySelector("[role=status]")?.textContent, "Open an article");
  state.destroy();
  assert.equal(column.querySelector(".vellum-editor-empty"), null);
  column.remove();
});
