import { describe, expect, test } from "vitest";

import { createState } from "../src/editor.ts";
import { insertCodeBlockTransaction } from "../src/features/fenced-code.ts";
import { parse } from "../src/parser.ts";
import { schema } from "../src/schema.ts";
import { renderedPosToMdOffset } from "../src/selection-md-map.ts";
import { ensureTrailingSentinel, selectionAtSentinelStart } from "../src/trailing-sentinel.ts";
import { serialize } from "../src/serializer.ts";

describe("selection-md-map", () => {
  test("maps a caret inside an empty code block to between fences", () => {
    const doc = ensureTrailingSentinel(parse("一些文字 下) 等"));
    const base = createState(doc);
    const state = base.apply(
      base.tr.setSelection(selectionAtSentinelStart(base.doc)!),
    );
    const next = state.apply(insertCodeBlockTransaction(state, schema));
    const md = serialize(next.doc);
    const offset = renderedPosToMdOffset(next.doc, next.selection.from);

    expect(next.doc.resolve(next.selection.from).parent.type.name).toBe("code_block");
    expect(md).toBe("一些文字 下) 等\n\n```\n\n```");
    expect(offset).toBe("一些文字 下) 等\n\n```\n".length);
    expect(md.slice(0, offset)).toBe("一些文字 下) 等\n\n```\n");
  });
});
