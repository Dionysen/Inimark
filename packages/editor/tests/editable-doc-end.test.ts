import { describe, expect, test } from "vitest";

import { parse } from "../src/parser.ts";
import { serialize } from "../src/serializer.ts";
import {
  docNeedsEditableEnd,
  ensureEditableDocEnd,
} from "../src/editable-doc-end.ts";
import { apply, setup } from "./utils.ts";

describe("editable document end", () => {
  test("ordinary paragraphs do not get a trailing empty block", () => {
    const doc = ensureEditableDocEnd(parse("hello"));
    expect(doc.childCount).toBe(1);
    expect(doc.lastChild?.type.name).toBe("paragraph");
    expect(doc.lastChild?.textContent).toBe("hello");
    expect(docNeedsEditableEnd(doc)).toBe(false);
    expect(serialize(doc).trimEnd()).toBe("hello");
  });

  test("a table at the document end gets a following paragraph", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const doc = ensureEditableDocEnd(parse(md));
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).type.name).toBe("table");
    expect(doc.child(1).type.name).toBe("paragraph");
    expect(doc.child(1).content.size).toBe(0);
  });

  test("typing after a paragraph does not invent a phantom blank line on save", () => {
    const state = apply(setup("hello"), [" after"]);
    expect(serialize(state.doc).trimEnd()).toBe("hello after");
  });
});
