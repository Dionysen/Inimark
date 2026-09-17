import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import { getWikiLinkBridge } from "@inimark/editor";

/** Parse `[[note#heading|alias]]` / `![[…]]` body into structured fields. */
function parseWikiTarget(content: string): {
  noteName: string;
  heading?: string;
  alias?: string;
} {
  const pipeIndex = content.indexOf("|");
  const displayPart = pipeIndex >= 0 ? content.slice(pipeIndex + 1) : undefined;
  const notePart = pipeIndex >= 0 ? content.slice(0, pipeIndex) : content;
  const hashIndex = notePart.indexOf("#");
  const noteName = (hashIndex >= 0 ? notePart.slice(0, hashIndex) : notePart).trim();
  const heading = hashIndex >= 0 ? notePart.slice(hashIndex + 1).trim() : "";
  const alias = displayPart?.trim() || undefined;
  return {
    noteName,
    heading: heading || undefined,
    alias,
  };
}

function wikiLinkRule(state: StateInline, silent: boolean): boolean {
  const { src, pos, posMax } = state;
  let cursor = pos;
  let isEmbed = false;
  if (src.startsWith("![[", cursor)) {
    isEmbed = true;
    cursor += 3;
  } else if (src.startsWith("[[", cursor)) {
    cursor += 2;
  } else {
    return false;
  }

  const close = src.indexOf("]]", cursor);
  if (close < 0 || close > posMax) return false;
  const inner = src.slice(cursor, close);
  if (!inner.trim()) return false;

  const { noteName, heading, alias } = parseWikiTarget(inner);
  if (!noteName) return false;

  if (!silent) {
    const bridge = getWikiLinkBridge();
    const resolved = bridge?.resolveNote(noteName) ?? null;
    const unresolved = !resolved;
    const label = alias || (heading ? `${noteName} › ${heading}` : noteName);
    const token = state.push("inimark_ai_wiki", "a", 0);
    token.content = label;
    token.attrs = [
      ["href", "#"],
      ["class", unresolved ? "inimark-ai-wiki is-unresolved" : "inimark-ai-wiki"],
      ["data-note", noteName],
    ];
    if (heading) token.attrs.push(["data-heading", heading]);
    if (unresolved) token.attrs.push(["data-unresolved", "1"]);
    if (isEmbed) token.attrs.push(["data-embed", "1"]);
  }

  state.pos = close + 2;
  return true;
}

/** Render Obsidian-style `[[wikilinks]]` as clickable vault links in AI chat. */
export function wikiLinksPlugin(md: MarkdownIt): void {
  md.inline.ruler.before("link", "inimark-ai-wiki", wikiLinkRule);
  md.renderer.rules.inimark_ai_wiki = (tokens, idx) => {
    const token = tokens[idx]!;
    const attrs = md.renderer.renderAttrs(token);
    return `<a${attrs}>${md.utils.escapeHtml(token.content)}</a>`;
  };
}
