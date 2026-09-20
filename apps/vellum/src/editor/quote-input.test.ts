import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Window } from "happy-dom";
import { mountPlaintextEditor, type PlaintextEditor } from "./plaintext.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, { window: happy, document: happy.document, HTMLElement: happy.HTMLElement, Node: happy.Node });
const doc = happy.document;
// happy-dom has no layout or editing commands. Exercise the actual event handlers
// with a minimal native insertion stand-in; browser undo needs browser coverage.
Object.defineProperty(happy.Range.prototype, "getClientRects", {
  value: () => [{ left: 10, top: 10, right: 80, bottom: 30, width: 70, height: 20 }],
});
let editor: PlaintextEditor;
function mount(value = "") {
  const host = doc.createElement("div");
  doc.body.append(host);
  editor = mountPlaintextEditor(host as unknown as HTMLElement, { value, getFirstLineIndent: () => 0 });
  editor.focusAtEnd();
  return editor;
}
function nativeInsert(text: string, inputType = "insertText") {
  const sel = happy.getSelection()!;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = doc.createTextNode(text);
  range.insertNode(node);
  range.setStart(node, text.length);
  range.collapse(true);
  sel.collapse(node, text.length);
  editor.el.dispatchEvent(new happy.InputEvent("input", { bubbles: true, inputType, data: text }) as unknown as Event);
}
Object.defineProperty(doc, "execCommand", { configurable: true, value: (_command: string, _ui: boolean, text: string) => { nativeInsert(text); return true; } });
function type(text: string) {
  const event = new happy.InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text });
  editor.el.dispatchEvent(event as unknown as Event);
  if (!event.defaultPrevented) nativeInsert(text);
}
function enter(init: Record<string, unknown> = {}) {
  const event = new happy.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  editor.el.dispatchEvent(event as unknown as Event);
  return event;
}
function caret() {
  const selection = happy.getSelection()!;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor.el as unknown as Node);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}
function frame() { return doc.querySelector(".vellum-quote-frame"); }
afterEach(() => { editor?.destroy(); doc.body.replaceChildren(); });

describe("paired-symbol input", () => {
  for (const [open, close] of [["\"", "\""], ["'", "'"], ["“", "”"], ["‘", "’"], ["「", "」"], ["『", "』"], ["＂", "＂"], ["＇", "＇"],
    ["｢", "｣"], ["`", "`"], ["(", ")"], ["（", "）"], ["[", "]"], ["［", "］"],
    ["【", "】"], ["{", "}"], ["｛", "｝"], ["<", ">"], ["＜", "＞"], ["《", "》"],
    ["〈", "〉"], ["〔", "〕"], ["〖", "〗"], ["〘", "〙"], ["〚", "〛"], ["｟", "｠"],
  ]) {
    it(`pairs ${open}${close}, outlines the content, and exits on Enter without changing text`, () => {
      mount(); type(open!);
      assert.equal(editor.getValue(), open! + close!);
      assert.equal(caret(), 1);
      assert.ok(frame());
      type("中文");
      assert.equal(editor.getValue(), open + "中文" + close);
      assert.ok(frame());
      assert.equal(enter().defaultPrevented, true);
      assert.equal(caret(), 4);
      assert.equal(frame(), null);
      assert.equal(editor.getValue(), open + "中文" + close);
      enter();
      assert.equal(editor.getValue(), open + "中文" + close + "\n");
      editor.setValue(""); editor.focusAtEnd(); type(open!); type(close!);
      assert.equal(editor.getValue(), open! + close!);
      assert.equal(caret(), 2);
      assert.equal(frame(), null);
    });
  }
  it("preserves apostrophes in words and skips a matching closing quote", () => {
    mount("don"); type("'"); type("t");
    assert.equal(editor.getValue(), "don't");
    assert.equal(frame(), null);
    editor.setValue(""); editor.focusAtEnd(); type("“"); type("”");
    assert.equal(editor.getValue(), "“”"); assert.equal(caret(), 2); assert.equal(frame(), null);
  });
  it("pairs straight quotes after Chinese prose and leaves inch marks alone", () => {
    mount("他说"); type('"'); type("你好"); enter();
    assert.equal(editor.getValue(), '他说"你好"'); assert.equal(caret(), 6);
    editor.setValue("12"); editor.focusAtEnd(); type('"');
    assert.equal(editor.getValue(), '12"'); assert.equal(frame(), null);
  });
  it("does not consume composition Enter, including keyCode 229", () => {
    mount(); type("“");
    editor.el.dispatchEvent(new happy.CompositionEvent("compositionstart") as unknown as Event);
    assert.equal(enter().defaultPrevented, false);
    nativeInsert("汉", "insertCompositionText");
    assert.equal(editor.getValue(), "“汉”"); assert.ok(frame());
    editor.el.dispatchEvent(Object.assign(new happy.Event("compositionend"), { data: "汉" }) as unknown as Event);
    assert.equal(enter({ keyCode: 229 }).defaultPrevented, false);
    assert.equal(enter({ isComposing: true }).defaultPrevented, false);
    assert.ok(frame()); enter(); assert.equal(caret(), 3); assert.equal(frame(), null);
  });
  for (const [open, close] of [["“", "”"], ["（", "）"], ["【", "】"], ["《", "》"]]) {
  it(`pairs ${open} committed by an IME after composition ends`, async () => {
    mount();
    editor.el.dispatchEvent(new happy.CompositionEvent("compositionstart") as unknown as Event);
    nativeInsert(open!, "insertCompositionText");
    editor.el.dispatchEvent(Object.assign(new happy.Event("compositionend"), { data: open }) as unknown as Event);
    await Promise.resolve();
    assert.equal(editor.getValue(), open! + close!); assert.equal(caret(), 1); assert.ok(frame());
  });
  }
  it("clears stale sessions on history input and document replacement", () => {
    mount(); type("“"); type("文");
    editor.el.dispatchEvent(new happy.InputEvent("input", { inputType: "historyUndo" }) as unknown as Event);
    assert.equal(frame(), null); enter(); assert.equal(editor.getValue(), "“文\n”");
    editor.setValue(""); editor.focusAtEnd(); type("“");
    editor.setValue("other"); assert.equal(frame(), null);
  });
  it("cancels when the caret moves outside or a quote is deleted", () => {
    mount(); type("“"); editor.focusAtEnd();
    doc.dispatchEvent(new happy.Event("selectionchange"));
    assert.equal(frame(), null); enter(); assert.equal(editor.getValue(), "“”\n");
    editor.setValue(""); editor.focusAtEnd(); type("“");
    editor.el.querySelector("p")!.textContent = "”";
    editor.el.dispatchEvent(new happy.InputEvent("input", { inputType: "deleteContentBackward" }) as unknown as Event);
    assert.equal(frame(), null);
  });
  it("leaves Shift+Enter to the browser", () => {
    mount(); type("“");
    assert.equal(enter({ shiftKey: true }).defaultPrevented, false);
  });
});
