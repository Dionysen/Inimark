import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { focusEditorAtPoint, focusPosFromClick, handleEditorSurfaceMouseDown, needsClickRedirect } from "../src/click-focus.ts";
import { createEditor } from "../src/lib.ts";
import { setup } from "./utils.ts";

function click(view: EditorView, clientX: number, clientY: number): void {
  view.dom.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
    }),
  );
}

describe("click focus", () => {
  test("click below empty document content focuses the sentinel paragraph", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "" });

    try {
      const rect = host.getBoundingClientRect();
      host.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 40,
          clientY: rect.bottom - 20,
          button: 0,
        }),
      );
      expect(editor.view.hasFocus()).toBe(true);
      expect(editor.view.state.selection.empty).toBe(true);
      expect(editor.view.state.doc.lastChild?.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("click on host padding outside ProseMirror still focuses the editor", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    host.style.padding = "24px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "" });

    try {
      expect(handleEditorSurfaceMouseDown(editor.view, {
        button: 0,
        target: host,
        clientX: host.getBoundingClientRect().left + 8,
        clientY: host.getBoundingClientRect().bottom - 8,
        preventDefault() {},
      } as unknown as MouseEvent, host)).toBe(true);
      expect(editor.view.hasFocus()).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("click on code block padding focuses the nearest prose block", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });

    try {
      const block = host.querySelector(".code-block-node") as HTMLElement;
      expect(block).not.toBeNull();
      const rect = block.getBoundingClientRect();
      block.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 12,
          clientY: rect.top + 4,
          button: 0,
        }),
      );
      const pos = editor.view.state.selection.from;
      const $pos = editor.view.state.doc.resolve(pos);
      expect($pos.parent.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("focusPosFromClick maps gaps between blocks to a nearby caret", () => {
    const state = setup("one\n\ntwo");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      const first = view.dom.children[0]!.getBoundingClientRect();
      const second = view.dom.children[1]!.getBoundingClientRect();
      const gapY = (first.bottom + second.top) / 2;
      const pos = focusPosFromClick(view, first.left + 8, gapY);
      expect(pos).not.toBeNull();
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos!)));
      expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("focusEditorAtPoint returns false for non-editable views", () => {
    const state = setup("hello");
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state, editable: () => false });

    try {
      const rect = view.dom.getBoundingClientRect();
      expect(focusEditorAtPoint(view, rect.left + 8, rect.bottom - 8)).toBe(false);
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  test("needsClickRedirect is false when clicking the trailing sentinel paragraph", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      const sentinel = view.dom.lastElementChild as HTMLElement;
      expect(sentinel?.tagName).toBe("P");
      const rect = sentinel.getBoundingClientRect();
      expect(
        needsClickRedirect(view, rect.left + 4, rect.top + 4, sentinel),
      ).toBe(false);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("redirected mousedown from host padding starts nearest-pos drag tracking", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "alpha\n\nbeta" });

    try {
      const view = editor.view;
      const hostRect = host.getBoundingClientRect();
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: hostRect.left + 40,
        clientY: hostRect.bottom - 12,
        button: 0,
        buttons: 1,
      });
      Object.defineProperty(down, "target", { value: host });

      expect(handleEditorSurfaceMouseDown(view, down, host)).toBe(true);
      expect(view.hasFocus()).toBe(true);
      expect(view.state.selection.empty).toBe(true);

      // End the drag session started by focusEditorAtPoint.
      window.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          clientX: hostRect.left + 40,
          clientY: hostRect.bottom - 12,
          button: 0,
          buttons: 0,
        }),
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
