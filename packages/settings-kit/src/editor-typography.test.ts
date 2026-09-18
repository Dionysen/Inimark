import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { Window } from "happy-dom";
import {
  DEFAULT_EDITOR_TYPOGRAPHY,
  EDITOR_WIDTH_MIN,
  FIRST_LINE_INDENT_MAX,
  IDEOGRAPHIC_SPACE,
  applyEditorTypographyCss,
  firstLineIndentPrefix,
  normalizeEditorTypography,
  readFirstLineIndent,
} from "./editor-typography.ts";

before(() => {
  const win = new Window({ url: "https://localhost/" });
  (globalThis as { document?: Document }).document =
    win.document as unknown as Document;
  (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement =
    win.HTMLElement as unknown as typeof HTMLElement;
});

describe("firstLineIndentPrefix", () => {
  it("repeats ideographic spaces within 0–4", () => {
    assert.equal(firstLineIndentPrefix(0), "");
    assert.equal(firstLineIndentPrefix(2), IDEOGRAPHIC_SPACE.repeat(2));
    assert.equal(firstLineIndentPrefix(9), IDEOGRAPHIC_SPACE.repeat(FIRST_LINE_INDENT_MAX));
    assert.equal(firstLineIndentPrefix(-1), "");
  });
});

describe("normalizeEditorTypography", () => {
  it("fills defaults and clamps width to the ceiling", () => {
    const normalized = normalizeEditorTypography(
      { fontSize: 99, editorWidth: 5000, firstLineIndent: 3.6 },
      { editorWidthMax: 900, fontSizeMax: 28 },
    );
    assert.equal(normalized.fontSize, 28);
    assert.equal(normalized.editorWidth, 900);
    assert.equal(normalized.firstLineIndent, 4);
    assert.equal(normalized.editorFont, DEFAULT_EDITOR_TYPOGRAPHY.editorFont);
  });

  it("keeps a readable width floor", () => {
    const normalized = normalizeEditorTypography(
      { editorWidth: 10 },
      { editorWidthMax: 800 },
    );
    assert.equal(normalized.editorWidth, EDITOR_WIDTH_MIN);
  });
});

describe("applyEditorTypographyCss", () => {
  it("writes shell tokens and indent dataset", () => {
    const root = document.createElement("div");
    applyEditorTypographyCss(
      root,
      {
        ...DEFAULT_EDITOR_TYPOGRAPHY,
        fontSize: 18,
        editorWidth: 640,
        firstLineIndent: 2,
        paragraphSpacing: 1.2,
      },
      "shell",
    );
    assert.equal(root.style.getPropertyValue("--shell-editor-font-size"), "18px");
    assert.equal(root.style.getPropertyValue("--shell-editor-max-width"), "640px");
    assert.equal(root.style.getPropertyValue("--shell-editor-paragraph-spacing"), "1.2em");
    assert.equal(root.dataset.firstLineIndent, "2");
    assert.equal(readFirstLineIndent(root), 2);
  });

  it("writes editor profile tokens without indent dataset", () => {
    const root = document.createElement("div");
    applyEditorTypographyCss(root, DEFAULT_EDITOR_TYPOGRAPHY, "editor");
    assert.ok(root.style.getPropertyValue("--editor-font-size"));
    assert.ok(root.style.getPropertyValue("--inimark-editor-max-width"));
    assert.equal(root.dataset.firstLineIndent, undefined);
  });
});
