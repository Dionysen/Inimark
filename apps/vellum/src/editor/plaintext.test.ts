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

describe("mountPlaintextEditor focusAtEnd", () => {
  it("places a collapsed caret at the end of the last line", () => {
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "甲\n乙",
    });

    editor.focusAtEnd();

    const last = editor.el.lastElementChild;
    assert.ok(last);
    const sel = happy.getSelection();
    assert.ok(sel && sel.rangeCount > 0);
    const range = sel.getRangeAt(0);
    assert.equal(range.collapsed, true);

    const pre = doc.createRange();
    pre.selectNodeContents(last as unknown as Node);
    pre.setEnd(range.startContainer, range.startOffset);
    assert.equal(pre.toString(), "乙");

    editor.destroy();
    host.remove();
  });
});

const clip = { value: "" };
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    clipboard: {
      writeText: async (text: string) => {
        clip.value = text;
      },
      readText: async () => clip.value,
    },
  },
});

function selectOffsets(editorEl: HTMLElement, start: number, end: number): void {
  const p = editorEl.querySelector("p");
  assert.ok(p?.firstChild);
  const range = doc.createRange();
  range.setStart(p.firstChild as Node, start);
  range.setEnd(p.firstChild as Node, end);
  const sel = happy.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe("plaintext clipboard", () => {
  it("copy and cut no-op without a selection", async () => {
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    editor.el.focus();
    const p = editor.el.querySelector("p");
    assert.ok(p?.firstChild);
    const range = doc.createRange();
    range.setStart(p.firstChild as Node, 2);
    range.collapse(true);
    const sel = happy.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    assert.equal(editor.hasSelection(), false);
    assert.equal(await editor.copySelection(), false);
    assert.equal(await editor.cutSelection(), false);
    assert.equal(editor.getValue(), "hello");
    editor.destroy();
    host.remove();
  });

  it("copies the selected text and cut removes it", async () => {
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    clip.value = "";
    selectOffsets(editor.el, 0, 3);
    assert.equal(editor.hasSelection(), true);
    assert.equal(await editor.copySelection(), true);
    assert.equal(clip.value, "hel");
    assert.equal(editor.getValue(), "hello");

    selectOffsets(editor.el, 0, 3);
    assert.equal(await editor.cutSelection(), true);
    assert.equal(clip.value, "hel");
    assert.equal(editor.getValue(), "lo");
    editor.destroy();
    host.remove();
  });

  it("paste inserts at the caret and replaces a selection", async () => {
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    clip.value = "XY";
    const p = editor.el.querySelector("p");
    assert.ok(p?.firstChild);
    const caret = doc.createRange();
    caret.setStart(p.firstChild as Node, 5);
    caret.collapse(true);
    const sel = happy.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);
    assert.equal(await editor.pasteClipboard(), true);
    assert.equal(editor.getValue(), "helloXY");

    selectOffsets(editor.el, 0, 5);
    clip.value = "Z";
    assert.equal(await editor.pasteClipboard(), true);
    assert.equal(editor.getValue(), "ZXY");
    editor.destroy();
    host.remove();
  });
});
