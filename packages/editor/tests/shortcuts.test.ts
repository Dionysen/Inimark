import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { apply, setup } from "./utils.ts";
import { serialize } from "../src/serializer.ts";

function selectText(md: string, from: number, to: number) {
  const state = setup(md);
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

describe("common editing shortcuts", () => {
  test("Mod-b wraps the selection in strong delimiters", () => {
    const state = selectText("bold", 1, 5);
    const next = apply(state, ["<Mod-b>"]);
    expect(serialize(next.doc)).toBe("**bold**");
  });

  test("Mod-i wraps the selection in emphasis delimiters", () => {
    const state = selectText("em", 1, 3);
    const next = apply(state, ["<Mod-i>"]);
    expect(serialize(next.doc)).toBe("*em*");
  });

  test("Mod-k inserts an empty inline link shell at the cursor", () => {
    const next = apply(setup("go"), ["<Mod-k>", "x"]);
    expect(serialize(next.doc)).toBe("go[x](url)");
  });

  test("format shortcuts wrap underline, inline code, and strikethrough", () => {
    expect(serialize(apply(selectText("text", 1, 5), ["<Mod-u>"]).doc)).toBe("<u>text</u>");
    expect(serialize(apply(selectText("text", 1, 5), ["<Mod-Shift-`>"]).doc)).toBe("`text`");
    expect(serialize(apply(selectText("text", 1, 5), ["<Alt-Shift-5>"]).doc)).toBe("~~text~~");
  });

  test("Mod-k wraps selected text in a link shell", () => {
    const next = apply(selectText("docs", 1, 5), ["<Mod-k>"]);
    expect(serialize(next.doc)).toBe("[docs](url)");
  });

  test("Mod-1 turns the current paragraph into an ATX heading", () => {
    const next = apply(setup("Title"), ["<Mod-1>"]);
    expect(serialize(next.doc)).toBe("# Title");
  });

  test("Mod-0 turns the current heading into a paragraph", () => {
    const next = apply(setup("# Title"), ["<Mod-0>"]);
    expect(serialize(next.doc)).toBe("Title");
  });

  test("Alt-Mod-b inserts a math block", () => {
    const next = apply(setup(""), ["<Alt-Mod-b>"]);
    expect(serialize(next.doc)).toBe("$$\n\n$$");
  });

  test("Shift-Enter inserts a Markdown hard break", () => {
    const next = apply(setup("line"), ["<Shift-Enter>", "next"]);
    expect(serialize(next.doc)).toBe("line  \nnext");
  });

  test("Shift-Enter keeps following text after a hard break node", () => {
    const next = apply(setup("line"), ["<Shift-Enter>", "next"]);
    const paragraph = next.doc.firstChild;
    expect(paragraph?.childCount).toBe(3);
    expect(paragraph?.child(0).textContent).toBe("line");
    expect(paragraph?.child(1).type.name).toBe("hard_break");
    expect(paragraph?.child(2).textContent).toBe("next");
  });

  test("Alt-Mod-c inserts an empty fenced code block shell", () => {
    const next = apply(setup(""), ["<Alt-Mod-c>"]);
    expect(serialize(next.doc)).toBe("```\n\n```");
    expect(next.doc.resolve(next.selection.from).parent.type.name).toBe("code_block");
  });

  test("Alt-Mod-c places the caret inside a code block inserted after text", () => {
    const next = apply(setup("hello"), ["<Alt-Mod-c>"]);
    expect(serialize(next.doc)).toBe("hello\n\n```\n\n```");
    expect(next.doc.resolve(next.selection.from).parent.type.name).toBe("code_block");
  });

  test("Alt-Mod-u wraps the current paragraph in a bullet list", () => {
    const next = apply(setup("item"), ["<Alt-Mod-u>"]);
    expect(serialize(next.doc)).toBe("- item");
  });

  test("Alt-Mod-o wraps the current paragraph in an ordered list", () => {
    const next = apply(setup("item"), ["<Alt-Mod-o>"]);
    expect(serialize(next.doc)).toBe("1. item");
  });

  test("Alt-Mod-x turns the current paragraph into a task list", () => {
    const next = apply(setup("item"), ["<Alt-Mod-x>"]);
    expect(serialize(next.doc)).toBe("- [ ] item");
  });

  test("Alt-Mod-q wraps the current paragraph in a blockquote", () => {
    const next = apply(setup("quote"), ["<Alt-Mod-q>"]);
    expect(serialize(next.doc)).toBe("> quote");
  });

  test("Alt-Mod-r inserts a footnote marker", () => {
    const next = apply(setup("text"), ["<Alt-Mod-r>"]);
    expect(serialize(next.doc)).toBe("text\\[^\\]");
  });

  test("Mod-= promotes the current heading level", () => {
    const next = apply(setup("## Title"), ["<Mod-=>"]);
    expect(serialize(next.doc)).toBe("# Title");
  });

  test("Mod-- demotes the current heading level", () => {
    const next = apply(setup("# Title"), ["<Mod-->"]);
    expect(serialize(next.doc)).toBe("## Title");
  });

  test("Alt-Mod-- inserts a horizontal rule", () => {
    const next = apply(setup("before"), ["<Alt-Mod-->"]);
    expect(serialize(next.doc)).toBe("before\n\n---");
  });

  test("undo and redo are wired through common shortcuts", () => {
    const next = apply(setup(""), ["a", "<Mod-z>", "<Mod-y>"]);
    expect(serialize(next.doc)).toBe("a");
  });

  test("empty format blocks toggle back to paragraph with the same shortcut", () => {
    expect(serialize(apply(apply(setup(""), ["<Mod-1>"]), ["<Mod-1>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-q>"]), ["<Alt-Mod-q>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-u>"]), ["<Alt-Mod-u>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-o>"]), ["<Alt-Mod-o>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-x>"]), ["<Alt-Mod-x>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-c>"]), ["<Alt-Mod-c>"]).doc)).toBe("");
    expect(serialize(apply(apply(setup(""), ["<Alt-Mod-b>"]), ["<Alt-Mod-b>"]).doc)).toBe("");
  });
});
