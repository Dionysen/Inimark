import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import {
  firstLineIndentPrefix,
  IDEOGRAPHIC_SPACE,
} from "@dionysen/settings-kit/editor-typography";
import {
  mountPlaintextEditor,
  plaintextToHtml,
  serializePlaintextDom,
} from "./plaintext.ts";

const happy = new Window({ url: "https://localhost/" });
const doc = happy.document;

// Isolate DOM globals for this test file without fighting TypeScript's Window.
Object.assign(globalThis, {
  document: doc,
  window: happy,
  HTMLElement: happy.HTMLElement,
  Node: happy.Node,
  getSelection: () => happy.getSelection(),
});

describe("plaintextToHtml / serializePlaintextDom", () => {
  it("round-trips newlines as paragraphs", () => {
    const html = plaintextToHtml("甲\n乙\n");
    const host = doc.createElement("div");
    host.innerHTML = html;
    assert.equal(serializePlaintextDom(host as unknown as HTMLElement), "甲\n乙\n");
  });

  it("keeps empty paragraphs as blank lines", () => {
    const html = plaintextToHtml("a\n\nb");
    const host = doc.createElement("div");
    host.innerHTML = html;
    assert.equal(host.querySelectorAll("p").length, 3);
    assert.equal(serializePlaintextDom(host as unknown as HTMLElement), "a\n\nb");
  });
});

describe("mountPlaintextEditor Enter indent", () => {
  it("inserts ideographic spaces on new paragraphs", () => {
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "第一段",
      getFirstLineIndent: () => 2,
    });
    editor.el.focus();
    const p = editor.el.querySelector("p");
    assert.ok(p);
    const range = doc.createRange();
    range.selectNodeContents(p as unknown as Node);
    range.collapse(false);
    const sel = happy.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    editor.el.dispatchEvent(
      new happy.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }) as unknown as Event,
    );

    const value = editor.getValue();
    const lines = value.split("\n");
    assert.equal(lines[0], "第一段");
    assert.equal(lines[1], firstLineIndentPrefix(2));
    assert.equal(lines[1], IDEOGRAPHIC_SPACE.repeat(2));
    editor.destroy();
    host.remove();
  });
});
