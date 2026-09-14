/**
 * Shared tag lexer — single source of truth for editor scan and vault index.
 *
 * Syntax: `#name` / `#foo/bar`. A tag must sit at the start of the text /
 * line, or be preceded by whitespace (so `的#define` / `“#if”` are not tags).
 * Not a heading: `# Title` needs a space after the hashes. Front matter
 * `tags:` / `tag:` are also collected by {@link collectTagNamesFromMarkdown}.
 */

/** Tag body: letters, digits, `_`, `-`, `/` (nested), and CJK. */
const TAG_BODY = String.raw`[\w\u4e00-\u9fff](?:[\w\u4e00-\u9fff/\-]*[\w\u4e00-\u9fff])?`;

/**
 * Match `#tag` only after start-of-string / whitespace.
 * Wiki-link should consume `[[note#heading]]` before tag scan runs.
 */
export const TAG_RE = new RegExp(`(?<![^\\s])#(${TAG_BODY})`, "gu");

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

function stripYamlQuotes(value: string): string {
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }
  return next.trim();
}

/** Normalize a YAML tag token to a legal tag name, or null if invalid. */
function normalizeFrontmatterTag(raw: string): string | null {
  let name = stripYamlQuotes(raw);
  if (name.startsWith("#")) name = name.slice(1).trim();
  return isValidTagName(name) ? name : null;
}

/** Split a YAML flow sequence, respecting simple quoted strings. */
function splitYamlFlowList(inner: string): string[] {
  const items: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const ch of inner) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      const name = normalizeFrontmatterTag(cur);
      if (name) items.push(name);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const name = normalizeFrontmatterTag(cur);
  if (name) items.push(name);
  return items;
}

/**
 * Split leading YAML front matter from the markdown body.
 * Returns null when the document does not start with a closed `---` block.
 */
export function splitMarkdownFrontmatter(
  markdown: string,
): { yaml: string; body: string } | null {
  if (!markdown.startsWith("---")) return null;
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  return {
    yaml: match[1] ?? "",
    body: markdown.slice(match[0]!.length),
  };
}

/**
 * Collect tag names from YAML `tags:` / `tag:` fields.
 * Supports flow lists, block lists, and a single scalar value.
 */
export function parseFrontmatterTagNames(yaml: string): string[] {
  const lines = yaml.split(/\r?\n/);
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const name = normalizeFrontmatterTag(raw);
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const field = line.match(/^(tags?)\s*:\s*(.*)$/i);
    if (!field) continue;

    const rest = (field[2] ?? "").trim();
    if (rest.startsWith("[") && rest.endsWith("]")) {
      for (const item of splitYamlFlowList(rest.slice(1, -1))) add(item);
      continue;
    }
    if (rest) {
      add(rest);
      continue;
    }

    // Block list: following indented `- item` lines.
    while (i + 1 < lines.length) {
      const next = lines[i + 1]!;
      const item = next.match(/^\s*-\s+(.+?)\s*$/);
      if (!item) break;
      i += 1;
      add(item[1]!);
    }
  }

  return names;
}

/**
 * Collect unique tag names from markdown (for vault indexing / sidebar).
 * Includes YAML front matter `tags` / `tag`, then inline `#tag` in the body.
 * Strips fenced and inline code so they don't invent false tags.
 */
export function collectTagNamesFromMarkdown(markdown: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const add = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  const split = splitMarkdownFrontmatter(markdown);
  if (split) {
    for (const name of parseFrontmatterTagNames(split.yaml)) add(name);
  }

  const body = split ? split.body : markdown;
  const withoutFences = body.replace(/^(`{3,})[\s\S]*?\n\1[ \t]*$/gm, "");
  const withoutInlineCode = withoutFences.replace(/`[^`\n]+`/g, "");
  for (const tag of scanTagsInText(withoutInlineCode)) add(tag.name);
  return names;
}
