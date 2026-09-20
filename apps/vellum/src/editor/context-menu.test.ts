import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { dismissExclusiveLayers } from "@dionysen/ui";
import { initI18n } from "../i18n/index.ts";
import { mountEditorContextMenu } from "./context-menu.ts";
import { mountPlaintextEditor } from "./plaintext.ts";

const happy = new Window({ url: "https://localhost/" });
const doc = happy.document;

Object.assign(globalThis, {
  document: doc,
  window: happy,
  HTMLElement: happy.HTMLElement,
  Element: happy.Element,
  Node: happy.Node,
  localStorage: happy.localStorage,
  getSelection: () => happy.getSelection(),
  requestAnimationFrame: (cb: (time: number) => void) =>
    setTimeout(() => cb(0), 0) as unknown as number,
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

initI18n("en");

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

function openEditorMenu(host: HTMLElement): HTMLElement {
  host.dispatchEvent(
    new happy.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    }) as unknown as Event,
  );
  const panel = doc.querySelector(".inimark-context-menu") as HTMLElement | null;
  assert.ok(panel);
  assert.equal(panel.hidden, false);
  assert.ok(panel.classList.contains("inimark-menu"));
  return panel;
}

describe("editor context menu", () => {
  it("opens on right-click with Copy, Cut, Paste rows and icons", () => {
    dismissExclusiveLayers();
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    const menu = mountEditorContextMenu(host as unknown as HTMLElement, editor);

    const panel = openEditorMenu(host as unknown as HTMLElement);
    const items = [...panel.querySelectorAll(".inimark-menu-item")];
    assert.equal(items.length, 3);
    assert.equal(items[0]?.textContent, "Copy");
    assert.equal(items[1]?.textContent, "Cut");
    assert.equal(items[2]?.textContent, "Paste");
    assert.ok(items[0]?.querySelector(".inimark-menu-item__icon svg"));
    assert.ok(items[1]?.querySelector(".inimark-menu-item__icon svg"));
    assert.ok(items[2]?.querySelector(".inimark-menu-item__icon svg"));

    menu.destroy();
    editor.destroy();
    host.remove();
    dismissExclusiveLayers();
  });

  it("disables copy and cut when there is no selection", () => {
    dismissExclusiveLayers();
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    const menu = mountEditorContextMenu(host as unknown as HTMLElement, editor);

    const p = editor.el.querySelector("p");
    assert.ok(p?.firstChild);
    const caret = doc.createRange();
    caret.setStart(p.firstChild as Node, 2);
    caret.collapse(true);
    const sel = happy.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);

    const panel = openEditorMenu(host as unknown as HTMLElement);
    const items = [...panel.querySelectorAll<HTMLButtonElement>(".inimark-menu-item")];
    assert.equal(items[0]?.disabled, true);
    assert.equal(items[1]?.disabled, true);
    assert.equal(items[2]?.disabled, false);

    menu.destroy();
    editor.destroy();
    host.remove();
    dismissExclusiveLayers();
  });

  it("copy and cut run clipboard actions for a selection", async () => {
    dismissExclusiveLayers();
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    const menu = mountEditorContextMenu(host as unknown as HTMLElement, editor);
    clip.value = "";
    selectOffsets(editor.el, 0, 3);

    const panel = openEditorMenu(host as unknown as HTMLElement);
    const items = [...panel.querySelectorAll<HTMLButtonElement>(".inimark-menu-item")];
    assert.equal(items[0]?.disabled, false);
    assert.equal(items[1]?.disabled, false);

    items[0]!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(clip.value, "hel");
    assert.equal(editor.getValue(), "hello");
    assert.equal(panel.hidden, true);

    selectOffsets(editor.el, 0, 3);
    openEditorMenu(host as unknown as HTMLElement);
    const cutItems = [...panel.querySelectorAll<HTMLButtonElement>(".inimark-menu-item")];
    cutItems[1]!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(clip.value, "hel");
    assert.equal(editor.getValue(), "lo");

    menu.destroy();
    editor.destroy();
    host.remove();
    dismissExclusiveLayers();
  });

  it("closes on the first mousedown outside the menu", () => {
    dismissExclusiveLayers();
    const host = doc.createElement("div");
    const outside = doc.createElement("div");
    doc.body.append(host, outside);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    const menu = mountEditorContextMenu(host as unknown as HTMLElement, editor);

    const panel = openEditorMenu(host as unknown as HTMLElement);
    outside.dispatchEvent(
      new happy.MouseEvent("mousedown", { bubbles: true }) as unknown as Event,
    );
    assert.equal(panel.hidden, true);

    menu.destroy();
    editor.destroy();
    host.remove();
    outside.remove();
    dismissExclusiveLayers();
  });

  it("paste inserts clipboard text at the caret", async () => {
    dismissExclusiveLayers();
    const host = doc.createElement("div");
    doc.body.append(host);
    const editor = mountPlaintextEditor(host as unknown as HTMLElement, {
      value: "hello",
    });
    const menu = mountEditorContextMenu(host as unknown as HTMLElement, editor);
    clip.value = "XYZ";

    const p = editor.el.querySelector("p");
    assert.ok(p?.firstChild);
    const caret = doc.createRange();
    caret.setStart(p.firstChild as Node, 5);
    caret.collapse(true);
    const sel = happy.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);

    const panel = openEditorMenu(host as unknown as HTMLElement);
    const items = [...panel.querySelectorAll<HTMLButtonElement>(".inimark-menu-item")];
    items[2]!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(editor.getValue(), "helloXYZ");
    assert.equal(panel.hidden, true);

    menu.destroy();
    editor.destroy();
    host.remove();
    dismissExclusiveLayers();
  });
});
