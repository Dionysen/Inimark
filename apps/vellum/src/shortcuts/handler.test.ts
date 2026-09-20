import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { isLibraryTreeFocused, mountShortcutHandler } from "./handler.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  window: happy,
  localStorage: happy.localStorage,
  document: happy.document,
  HTMLElement: happy.HTMLElement,
  Element: happy.Element,
  Node: happy.Node,
});

describe("isLibraryTreeFocused", () => {
  it("is true only inside the library tree", () => {
    const tree = happy.document.createElement("nav");
    tree.className = "vellum-library-tree";
    const row = happy.document.createElement("div");
    tree.append(row);
    const editor = happy.document.createElement("div");
    editor.className = "vellum-plaintext-editor";
    happy.document.body.append(tree, editor);

    assert.equal(isLibraryTreeFocused(row), true);
    assert.equal(isLibraryTreeFocused(editor), false);
    tree.remove();
    editor.remove();
  });
});


it("routes Ctrl+W to article close and Ctrl+Q to quit, including inside the editor", () => {
  happy.document.documentElement.classList.add("platform-windows");
  const editor = happy.document.createElement("div");
  editor.contentEditable = "true";
  editor.className = "vellum-plaintext-editor";
  happy.document.body.append(editor);
  const calls: string[] = [];
  const dispose = mountShortcutHandler({
    close: () => { calls.push("close-article"); },
    quit: () => { calls.push("quit"); },
  });
  try {
    for (const target of [editor, happy.document.body]) {
      for (const key of ["w", "q"]) {
        const event = new happy.KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
      }
    }
    assert.deepEqual(calls, ["close-article", "quit", "close-article", "quit"]);
  } finally {
    dispose();
    editor.remove();
    happy.document.documentElement.classList.remove("platform-windows");
  }
});
