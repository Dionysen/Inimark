import type { Node as PMNode } from "prosemirror-model";

import { markConsumed, type InlineSpan } from "../inline-parse.ts";
import { scanTagsInText } from "../tag-parse.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";

/**
 * Inline tags: `#name` / `#foo/bar`.
 *
 * Source stays in the doc (Method B). Mark `tag` renders with theme
 * `.tag` / `[data-type="tag"]` chips. Lexical rules live in `tag-parse.ts`
 * so desktop vault indexing can reuse them without pulling the feature graph.
 */

function rangeConsumed(consumed: Uint8Array, from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (consumed[i]) return true;
  return false;
}

const scan: InlineFeatureSpec["scan"] = (text, consumed) => {
  const out: InlineSpan[] = [];
  for (const tag of scanTagsInText(text)) {
    if (rangeConsumed(consumed, tag.from, tag.to)) continue;
    markConsumed(consumed, tag.from, tag.to);
    out.push({
      type: "tag",
      from: tag.from,
      to: tag.to,
      openFrom: tag.from,
      openTo: tag.from,
      closeFrom: tag.to,
      closeTo: tag.to,
      attrs: { name: tag.name },
      delimRanges: [],
    });
  }
  return out;
};

function tagExtRanges(parent: PMNode): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const markType = parent.type.schema.marks.tag;
  if (!markType) return ranges;
  let offset = 0;
  parent.forEach((child) => {
    if (child.isText) {
      const text = child.text ?? "";
      if (markType.isInSet(child.marks)) {
        ranges.push([offset, offset + text.length]);
      }
      offset += text.length;
    } else {
      offset += child.textContent.length;
    }
  });
  return ranges;
}

export const tag: FeatureSpec = {
  name: "tag",

  marks: {
    tag: {
      attrs: { name: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: "span.tag",
          getAttrs: (el) => ({
            name:
              (el as HTMLElement).getAttribute("data-tag") ??
              ((el as HTMLElement).textContent ?? "").replace(/^#/, ""),
          }),
        },
        {
          tag: '[data-type="tag"]',
          getAttrs: (el) => ({
            name:
              (el as HTMLElement).getAttribute("data-tag") ??
              ((el as HTMLElement).textContent ?? "").replace(/^#/, ""),
          }),
        },
      ],
      toDOM: (mark) => [
        "span",
        {
          class: "tag",
          "data-type": "tag",
          "data-tag": String(mark.attrs.name ?? ""),
        },
        0,
      ],
    },
  },

  markDelims: {
    tag: { open: "", close: "" },
  },

  inline: {
    // After wiki-link (55) so `[[note#heading]]` is consumed first.
    priority: 56,
    scan,
    markNames: ["tag"],
    extRanges: tagExtRanges,
  },
};
