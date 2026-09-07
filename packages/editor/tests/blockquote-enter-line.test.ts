import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { createEditor } from "../src/lib.ts";
import { feedEvent } from "../specs/events.ts";
import { fakeView } from "../specs/sim.ts";
import { pretty } from "../specs/pretty.ts";
import { selectionAtSentinelStart } from "../src/trailing-sentinel.ts";
import { setup } from "./utils.ts";

function docSummary(editor: ReturnType<typeof createEditor>) {
  const doc = editor.view.state.doc;
  return Array.from({ length: doc.childCount }, (_, i) => {
    const node = doc.child(i);
    return `${i}:${node.type.name}:${JSON.stringify(node.textContent)}`;
  }).join(" | ");
}

describe("blockquote after Enter on new line", () => {
  test("Enter at end of welcome paragraph then > space", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "# Welcome\n\nStart writing…" });

    try {
      const doc = editor.view.state.doc;
      const lastContentPos = doc.content.size - doc.lastChild!.nodeSize - 1;
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(doc, lastContentPos)),
      );
      feedEvent(editor.view, "<Enter>");
      expect(editor.view.state.selection.$from.parentOffset).toBe(0);
      feedEvent(editor.view, ">");
      feedEvent(editor.view, " ");
      const blockquote = editor.view.state.doc.child(
        editor.view.state.doc.childCount - 2,
      );
      expect(blockquote.type.name, docSummary(editor)).toBe("blockquote");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("Enter in trailing sentinel then > space", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "hello" });

    try {
      const sel = selectionAtSentinelStart(editor.view.state.doc)!;
      editor.view.dispatch(editor.view.state.tr.setSelection(sel));
      feedEvent(editor.view, "<Enter>");
      feedEvent(editor.view, ">");
      feedEvent(editor.view, " ");
      let sawBlockquote = false;
      editor.view.state.doc.forEach((node) => {
        if (node.type.name === "blockquote") sawBlockquote = true;
      });
      expect(sawBlockquote, docSummary(editor)).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});

describe("blockquote wrap fallback", () => {
  test("direct insertText bypasses input rules but appendTransaction still wraps", () => {
    const state = setup("");
    const view = fakeView(state);
    const from = view.state.selection.from;
    view.dispatch(view.state.tr.insertText("> ", from, from));
    expect(pretty(view.state)).toBe("<bq>|</bq>");
  });

  test("IME full-width space after > also wraps", () => {
    const state = setup("");
    const view = fakeView(state);
    const from = view.state.selection.from;
    view.dispatch(view.state.tr.insertText(">\u3000", from, from));
    expect(pretty(view.state)).toBe("<bq>|</bq>");
  });
});
