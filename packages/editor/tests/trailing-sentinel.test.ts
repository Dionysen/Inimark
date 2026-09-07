import { describe, expect, test } from "vitest";

import { parse } from "../src/parser.ts";
import { serialize } from "../src/serializer.ts";
import {
  docNeedsTrailingSentinel,
  ensureTrailingSentinel,
  isEmptyParagraph,
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
});
