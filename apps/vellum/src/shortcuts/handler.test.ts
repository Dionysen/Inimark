import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { isLibraryTreeFocused } from "./handler.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
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
