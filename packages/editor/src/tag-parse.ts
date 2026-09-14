/**
 * Shared tag lexer — single source of truth for editor scan and vault index.
 *
 * Syntax: `#name` / `#foo/bar` (Obsidian-style). Not heading `# Title`
 * (requires a space after the hashes).
 */

/** Tag body: letters, digits, `_`, `-`, `/` (nested), and CJK. */
const TAG_BODY = String.raw`[\w\u4e00-\u9fff](?:[\w\u4e00-\u9fff/\-]*[\w\u4e00-\u9fff])?`;

/**
 * Match `#tag` not glued to a preceding word/`#`.
 * Wiki-link should consume `[[note#heading]]` before tag scan runs.
 */
export const TAG_RE = new RegExp(`(?<![\\w#])#(${TAG_BODY})`, "gu");

export type ParsedTag = {
  /** Tag name without leading `#` (may contain `/`). */
  name: string;
  /** Inclusive start offset of `#` in `text`. */
  from: number;
  /** Exclusive end offset. */
  to: number;
};

/** True when `name` is a legal tag body (no leading `#`). */
export function isValidTagName(name: string): boolean {
  if (!name) return false;
  return new RegExp(`^${TAG_BODY}$`, "u").test(name);
}

/**
 * Scan plain text for tags. Optional `consumed` bitmap skips ranges claimed
 * by higher-priority inline features (code, wiki-link, …).
 */
export function scanTagsInText(
  text: string,
  consumed?: Uint8Array,
): ParsedTag[] {
  const out: ParsedTag[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text))) {
    const name = m[1]!;
    const from = m.index;
    const to = from + m[0]!.length;
    if (consumed) {
      let blocked = false;
      for (let i = from; i < to; i++) {
        if (consumed[i]) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }
    out.push({ name, from, to });
  }
  return out;
}

/**
 * Collect unique tag names from markdown (for vault indexing / sidebar).
 * Strips fenced and inline code so they don't invent false tags.
 */
export function collectTagNamesFromMarkdown(markdown: string): string[] {
  const withoutFences = markdown.replace(/^(`{3,})[\s\S]*?\n\1[ \t]*$/gm, "");
  const withoutInlineCode = withoutFences.replace(/`[^`\n]+`/g, "");
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tag of scanTagsInText(withoutInlineCode)) {
    if (seen.has(tag.name)) continue;
    seen.add(tag.name);
    names.push(tag.name);
  }
  return names;
}
