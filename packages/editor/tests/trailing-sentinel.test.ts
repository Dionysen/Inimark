import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { parse } from "../src/parser.ts";
import { serialize } from "../src/serializer.ts";
import {
  clampPosAwayFromSentinel,
  docNeedsTrailingSentinel,
  editableEndPos,
  ensureTrailingSentinel,
  isEmptyParagraph,
  posInTrailingSentinel,
  selectionAtEditableEnd,
  selectionAtSentinelStart,
  stripTrailingEmptyParagraphs,
} from "../src/trailing-sentinel.ts";
import { apply, setup } from "./utils.ts";

describe("trailing sentinel", () => {
  test("isEmptyParagraph matches only empty top-level paragraphs", () => {
    const empty = parse("").child(0);
    const text = parse("hello").child(0);
    expect(isEmptyParagraph(empty)).toBe(true);
    expect(isEmptyParagraph(text)).toBe(false);
  });

  test("ensureTrailingSentinel appends after a table at document end", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const doc = ensureTrailingSentinel(parse(md));
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).type.name).toBe("table");
    expect(isEmptyParagraph(doc.child(1))).toBe(true);
  });

  test("ensureTrailingSentinel is idempotent when sentinel already present", () => {
    const doc = ensureTrailingSentinel(parse("hello"));
    const again = ensureTrailingSentinel(doc);
    expect(again.eq(doc)).toBe(true);
    expect(docNeedsTrailingSentinel(doc)).toBe(false);
  });

  test("serialize strips trailing sentinel paragraphs", () => {
    const md = "> quote";
    const doc = ensureTrailingSentinel(parse(md));
    expect(doc.childCount).toBe(2);
    expect(serialize(doc)).toBe("> quote");
  });

  test("typing in the sentinel keeps save output clean", () => {
    const state = apply(setup("hello"), ["<ArrowDown>", "after"]);
    expect(serialize(state.doc)).toBe("hello\n\nafter");
  });

  test("stripTrailingEmptyParagraphs leaves middle content untouched", () => {
    const doc = parse("one\n\ntwo");
    const stripped = stripTrailingEmptyParagraphs(doc);
    expect(stripped.eq(doc)).toBe(true);
    expect(stripped.childCount).toBe(2);
  });

  test("clampPosAwayFromSentinel maps sentinel positions to editable end", () => {
    const doc = ensureTrailingSentinel(parse("hello"));
    const sentinel = selectionAtSentinelStart(doc)!;
    const end = editableEndPos(doc);
    expect(posInTrailingSentinel(doc, sentinel.from)).toBe(true);
    expect(clampPosAwayFromSentinel(doc, sentinel.from)).toBe(end);
    expect(clampPosAwayFromSentinel(doc, editableEndPos(doc))).toBe(end);
    // Node boundary and doc end must also clamp — these paint the empty line.
    expect(clampPosAwayFromSentinel(doc, sentinel.from - 1)).toBe(end);
    expect(clampPosAwayFromSentinel(doc, doc.content.size)).toBe(end);
  });

  test("plugin shrinks non-empty selections that include the sentinel", () => {
    const state = setup("hello\n\nworld");
    const sentinel = selectionAtSentinelStart(state.doc)!;
    const fromContent = TextSelection.create(state.doc, 1, sentinel.from);
    const next = state.apply(state.tr.setSelection(fromContent));
    expect(posInTrailingSentinel(next.doc, next.selection.to)).toBe(false);
    expect(next.selection.to).toBe(editableEndPos(next.doc));
    expect(next.selection.from).toBe(1);

    const throughDocEnd = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, 1, TextSelection.atEnd(state.doc).head),
      ),
    );
    expect(throughDocEnd.selection.to).toBe(editableEndPos(throughDocEnd.doc));
    expect(throughDocEnd.selection.to).toBeLessThan(sentinel.from);

    // Empty caret in the sentinel must remain so the user can type at the end.
    const caret = state.apply(
      state.tr.setSelection(selectionAtSentinelStart(state.doc)!),
    );
    expect(posInTrailingSentinel(caret.doc, caret.selection.from)).toBe(true);
    expect(caret.selection.empty).toBe(true);
  });

  test("selectionAtEditableEnd stays before the sentinel", () => {
    const doc = ensureTrailingSentinel(parse("hello"));
    const sel = selectionAtEditableEnd(doc);
    expect(posInTrailingSentinel(doc, sel.from)).toBe(false);
  });
});
