import { undo as cmUndo } from "@codemirror/commands";
import type { EditorView as CodeMirrorView } from "@codemirror/view";
import { describe, expect, test } from "vitest";
import { undo as pmUndo } from "prosemirror-history";

import { createEditor } from "../src/lib.ts";

function withEditor(
  initialContent: string,
  run: (editor: ReturnType<typeof createEditor>, host: HTMLElement) => void,
): void {
  const host = document.createElement("div");
  document.body.append(host);
  const editor = createEditor(host, { initialContent });
  try {
    run(editor, host);
  } finally {
    editor.destroy();
    host.remove();
  }
}

function sourceEditorView(host: HTMLElement): CodeMirrorView {
  const cmElement = host.querySelector<HTMLElement & { __typoraWebCodeMirrorView?: CodeMirrorView }>(
    ".typora-web-source-editor .cm-editor",
  );
  const cmView = cmElement?.__typoraWebCodeMirrorView;
  if (!cmView) throw new Error("source CodeMirror view not found");
  return cmView;
}

describe("find replace undo", () => {
  test("replaceCurrent is undoable in rendered mode", () => {
    withEditor("foo bar foo", (editor, _host) => {
      editor.configureFind({ query: "foo" });
      editor.replaceCurrent("baz");
      expect(editor.getMarkdown()).toBe("baz bar foo");

      pmUndo(editor.view.state, editor.view.dispatch);
      expect(editor.getMarkdown()).toBe("foo bar foo");
    });
  });

  test("replaceAll is undoable in rendered mode", () => {
    withEditor("foo bar foo", (editor, _host) => {
      editor.configureFind({ query: "foo" });
      expect(editor.replaceAll("baz")).toBe(2);
      expect(editor.getMarkdown()).toBe("baz bar baz");

      pmUndo(editor.view.state, editor.view.dispatch);
      expect(editor.getMarkdown()).toBe("foo bar foo");
    });
  });

  test("replaceCurrent is undoable in source mode", () => {
    withEditor("foo bar foo", (editor, host) => {
      editor.toggleSource();
      expect(editor.isSourceMode()).toBe(true);
      editor.configureFind({ query: "foo" });
      editor.replaceCurrent("baz");
      expect(editor.getMarkdown()).toBe("baz bar foo");

      cmUndo(sourceEditorView(host));
      expect(editor.getMarkdown()).toBe("foo bar foo");
    });
  });
});
