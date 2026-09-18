import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { bookTagText, promptBookEdit, type BookEditPrompt } from "./book-edit.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
  KeyboardEvent: happy.KeyboardEvent,
});

const prompt = (overrides: Partial<BookEditPrompt> = {}): BookEditPrompt => ({
  title: "Edit book",
  nameLabel: "Name",
  tagsLabel: "Tag",
  tagsPlaceholder: "Optional",
  name: "Dionysen",
  tags: "长篇",
  saveLabel: "Save",
  cancelLabel: "Cancel",
  nameRequired: "Enter a name",
  ...overrides,
});

describe("bookTagText", () => {
  it("trims a tag and treats blank as absent", () => {
    assert.equal(bookTagText("  长篇  "), "长篇");
    assert.equal(bookTagText("   "), "");
    assert.equal(bookTagText(null), "");
    assert.equal(bookTagText(undefined), "");
  });
});

describe("promptBookEdit", () => {
  it("returns the trimmed name and tag", async () => {
    const pending = promptBookEdit(prompt());
    const name = document.querySelectorAll("input")[0] as HTMLInputElement;
    const tags = document.querySelectorAll("input")[1] as HTMLInputElement;
    name.value = "  拾羽  ";
    tags.value = "  日记 ";
    document.querySelector("form")!.dispatchEvent(new happy.Event("submit", { bubbles: true, cancelable: true }));
    assert.deepEqual(await pending, { name: "拾羽", tags: "日记" });
    assert.equal(document.querySelector(".vellum-book-edit"), null);
  });

  it("keeps the dialog open when the name is empty", async () => {
    const pending = promptBookEdit(prompt());
    const name = document.querySelectorAll("input")[0] as HTMLInputElement;
    name.value = "   ";
    document.querySelector("form")!.dispatchEvent(new happy.Event("submit", { bubbles: true, cancelable: true }));
    const error = document.querySelector(".vellum-book-edit-error");
    assert.equal(error?.textContent, "Enter a name");
    assert.equal((error as HTMLElement).hidden, false);
    document.querySelector<HTMLButtonElement>(".inimark-confirm-dialog-btn")!.click();
    assert.equal(await pending, null);
  });

  it("cancels on Escape", async () => {
    const pending = promptBookEdit(prompt({ tags: "" }));
    document.dispatchEvent(new happy.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(await pending, null);
  });
});
