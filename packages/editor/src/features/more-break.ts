import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import type { Node as PMNode } from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import { leaveLineDraft } from "../block-draft.ts";
import { markConsumed, markExtRanges, type InlineSpan } from "../inline-parse.ts";
import { setCaretInTextblock } from "../selection-utils.ts";
import type { FeatureSpec, InlineFeatureSpec } from "./_types.ts";

const MORE_SOURCE = "<!--more-->";

/** Normalize smart punctuation (e.g. macOS `—` collapsing `<!--`) for matching. */
function normalizeMoreSourceInput(text: string): string {
  return text
    .trim()
    .replace(/^<!—/, "<!--")
    .replace(/^<!–/, "<!--")
    .replace(/[\u2013\u2014]/g, "-");
}

function matchesMoreSource(text: string): boolean {
  return normalizeMoreSourceInput(text) === MORE_SOURCE;
}

function isMoreSourceLine(line: string): boolean {
  return matchesMoreSource(line.replace(/\s+$/, ""));
}

const moreSourceScan: InlineFeatureSpec["scan"] = (text, consumed) => {
  if (!matchesMoreSource(text)) return [];
  markConsumed(consumed, 0, text.length);
  const out: InlineSpan[] = [
    {
      type: "more_source",
      from: 0,
      to: text.length,
      openFrom: 0,
      openTo: 0,
      closeFrom: text.length,
      closeTo: text.length,
    },
  ];
  return out;
};

const moreBreakRule: RuleBlock = (state, startLine, _endLine, silent) => {
  const start = state.bMarks[startLine]!;
  const end = state.eMarks[startLine]!;
  const line = state.src.slice(start, end);
  if (!isMoreSourceLine(line)) return false;
  if (silent) return true;

  const token = state.push("more_break", "div", 0);
  token.block = true;
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
};

function insertMoreBreak(schema: Schema): Command {
  return (state, dispatch) => {
    const node = schema.nodes.more_break!.create();
    const para = schema.nodes.paragraph!.create();
    const { from, to } = state.selection;
    if (dispatch) {
      const tr = state.tr.replaceWith(from, to, [node, para]);
      dispatch(setCaretInTextblock(tr, "paragraph").scrollIntoView());
    }
    return true;
  };
}

function makeMoreBreakPlugin(schema: Schema) {
  return leaveLineDraft({
    match: (text) =>
      matchesMoreSource(text)
        ? { data: null, prefixLen: normalizeMoreSourceInput(text).length }
        : null,
    draftClass: () => "more-break-draft",
    commit: (tr, pos, paragraph) => {
      const node = schema.nodes.more_break!.create();
      const parent = tr.doc.resolve(pos).parent;
      const idxOfPara = tr.doc.resolve(pos).index();
      const isLast = idxOfPara === parent.childCount - 1;
      if (isLast) {
        const empty = schema.nodes.paragraph!.create();
        tr.replaceWith(pos, pos + paragraph.nodeSize, [node, empty]);
      } else {
        tr.replaceWith(pos, pos + paragraph.nodeSize, node);
      }
    },
  });
}

function foldMoreBreakParagraphs(doc: PMNode): PMNode {
  const moreType = doc.type.schema.nodes.more_break;
  if (!moreType) return doc;

  const out: PMNode[] = [];
  let changed = false;
  doc.forEach((child) => {
    if (child.type.name === "paragraph" && matchesMoreSource(child.textContent)) {
      out.push(moreType.create());
      changed = true;
    } else {
      out.push(child);
    }
  });
  if (!changed) return doc;
  return doc.type.create(doc.attrs, out, doc.marks);
}

export const moreBreak: FeatureSpec = {
  name: "more-break",

  marks: {
    more_source: {
      inclusive: false,
      parseDOM: [{ tag: "mark-more-source" }],
      toDOM: () => ["mark-more-source", 0],
    },
  },

  markDelims: {
    more_source: { open: "", close: "" },
  },

  inline: {
    // Before html_comment (0.5) so `<!--more-->` is claimed here, not as a comment.
    priority: 0.45,
    scan: moreSourceScan,
    markNames: ["more_source"],
    extRanges: (parent) => {
      if (matchesMoreSource(parent.textContent)) return [[0, parent.content.size]];
      return markExtRanges(parent, "more_source", 0, 0);
    },
  },

  nodes: {
    more_break: {
      group: "block",
      atom: true,
      selectable: true,
      defining: true,
      parseDOM: [{ tag: "div.more-break" }],
      toDOM: () => [
        "div",
        { class: "more-break", contenteditable: "false" },
        ["span", { class: "more-break__rule", "aria-hidden": "true" }],
        ["span", { class: "more-break__label", "aria-hidden": "true" }],
        ["span", { class: "more-break__rule", "aria-hidden": "true" }],
      ],
    },
  },

  mdItPlugins: [
    (md) => {
      md.block.ruler.before("paragraph", "more_break", moreBreakRule, {
        alt: ["paragraph", "reference", "blockquote", "list"],
      });
    },
  ],

  parserTokens: {
    more_break: (state, _tok, schema) => {
      state.push(schema.nodes.more_break!.create());
    },
  },

  parserPostProcess: foldMoreBreakParagraphs,

  blockHandlers: {
    more_break: (state, node) => {
      state.write(MORE_SOURCE);
      state.closeBlock(node);
    },
  },

  plugins: (schema) => [makeMoreBreakPlugin(schema).plugin],

  keymap: (schema) => ({
    "Mod-Alt-m": insertMoreBreak(schema),
  }),
};

export { insertMoreBreak, MORE_SOURCE };
