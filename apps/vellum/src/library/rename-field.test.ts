import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { bindRenameField, RENAME_LABEL_CLASS } from "./rename-field.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
  MouseEvent: happy.MouseEvent,
  PointerEvent: happy.PointerEvent,
  KeyboardEvent: happy.KeyboardEvent,
});

function mountChapterRename(): {
  row: HTMLElement;
  input: HTMLInputElement;
  label: HTMLElement;
} {
  const row = happy.document.createElement("div");
  const label = happy.document.createElement("span");
  label.className = "inimark-tree-label vellum-chapter-body";
  const title = happy.document.createElement("span");
  title.className = "vellum-chapter-title";
  label.append(title);
  row.append(label);
  happy.document.body.append(row);

  const input = happy.document.createElement("input");
  title.replaceWith(input);
  bindRenameField(input as unknown as HTMLInputElement);
  return {
    row: row as unknown as HTMLElement,
    input: input as unknown as HTMLInputElement,
    label: label as unknown as HTMLElement,
  };
}

describe("bindRenameField", () => {
  it("lifts truncation on the chapter label that wraps the field", () => {
    const { label, row } = mountChapterRename();
    assert.ok(label.classList.contains(RENAME_LABEL_CLASS));
    row.remove();
  });

  it("does not mark a volume row, whose field replaces the label", () => {
    const row = happy.document.createElement("div");
    row.className = "inimark-tree-item";
    const label = happy.document.createElement("span");
    label.className = "inimark-tree-label";
    row.append(label);
    happy.document.body.append(row);

    const input = happy.document.createElement("input");
    label.replaceWith(input);
    bindRenameField(input as unknown as HTMLInputElement);

    assert.equal(row.classList.contains(RENAME_LABEL_CLASS), false);
    row.remove();
  });

  it("keeps click, pointer, and Space on the field so the row does not open", () => {
    const { row, input } = mountChapterRename();
    const seen: string[] = [];
    row.addEventListener("click", () => seen.push("click"));
    row.addEventListener("pointerdown", () => seen.push("pointerdown"));
    row.addEventListener("mousedown", () => seen.push("mousedown"));
    row.addEventListener("keydown", () => seen.push("keydown"));

    input.dispatchEvent(new happy.PointerEvent("pointerdown", { bubbles: true }));
    input.dispatchEvent(new happy.MouseEvent("mousedown", { bubbles: true }));
    input.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    input.dispatchEvent(new happy.KeyboardEvent("keydown", { key: " ", bubbles: true }));

    assert.deepEqual(seen, []);
    row.remove();
  });
});
