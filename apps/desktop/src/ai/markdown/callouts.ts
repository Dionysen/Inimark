import type MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type Token from "markdown-it/lib/token.mjs";

const CALLOUT_KIND_PATTERN = "NOTE|TIP|IMPORTANT|WARNING|WARN|DANGER|CAUTION";
const CALLOUT_RE = new RegExp(
  `^\\[!(${CALLOUT_KIND_PATTERN})\\](?:[ \\t]*(?:\\n|$)|[ \\t]+)`,
  "i",
);

type CalloutKind = "note" | "tip" | "important" | "warning" | "danger";

/** Normalize GitHub / Obsidian callout aliases to the editor's five kinds. */
function normalizeCalloutKind(raw: string): CalloutKind | null {
  switch (raw.trim().toLowerCase()) {
    case "note":
      return "note";
    case "tip":
      return "tip";
    case "important":
      return "important";
    case "warning":
    case "warn":
    case "caution":
      return "warning";
    case "danger":
      return "danger";
    default:
      return null;
  }
}

/**
 * Promote `> [!NOTE]` blockquotes into lightweight alert blocks.
 * Strips the marker token; empty marker-only first paragraphs are dropped.
 */
export function calloutsPlugin(md: MarkdownIt): void {
  md.core.ruler.after("inline", "inimark-ai-callouts", (state: StateCore) => {
    const { tokens } = state;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;

      const firstInline = findFirstInlineInBlockquote(tokens, i);
      if (firstInline < 0) continue;

      const inline = tokens[firstInline];
      const match = CALLOUT_RE.exec(inline.content);
      if (!match) continue;

      const kind = normalizeCalloutKind(match[1]);
      if (!kind) continue;

      tokens[i].attrJoin("class", `md-alert md-alert-${kind}`);
      tokens[i].attrSet("data-alert", kind);

      stripCalloutMarker(inline, match[0].length);

      if (!inline.content.trim()) {
        removeEmptyParagraphAround(tokens, firstInline);
      }
    }
  });
}

function findFirstInlineInBlockquote(tokens: Token[], openIndex: number): number {
  for (let j = openIndex + 1; j < tokens.length; j++) {
    if (tokens[j].type === "blockquote_close") return -1;
    if (tokens[j].type === "inline") return j;
  }
  return -1;
}

function stripCalloutMarker(inline: Token, markerLen: number): void {
  inline.content = inline.content.slice(markerLen);
  const first = inline.children?.[0];
  if (!first || first.type !== "text") return;

  const nested = CALLOUT_RE.exec(first.content);
  if (nested) {
    first.content = first.content.slice(nested[0].length);
    if (!first.content) inline.children!.shift();
    return;
  }
  if (first.content.length >= markerLen) {
    first.content = first.content.slice(markerLen);
    if (!first.content) inline.children!.shift();
  }
}

/** Drop `paragraph_open` + empty `inline` + `paragraph_close` around `inlineIndex`. */
function removeEmptyParagraphAround(tokens: Token[], inlineIndex: number): void {
  if (
    tokens[inlineIndex - 1]?.type !== "paragraph_open" ||
    tokens[inlineIndex + 1]?.type !== "paragraph_close"
  ) {
    return;
  }
  tokens.splice(inlineIndex - 1, 3);
}
