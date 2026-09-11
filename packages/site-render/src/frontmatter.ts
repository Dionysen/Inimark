/** Parse a few YAML front matter fields used by site publishing. */

export interface SiteFrontmatter {
  title?: string;
  /** Locale id, e.g. `zh` / `en`. */
  lang?: string;
  /** Shared key pairing translations across languages. */
  translationKey?: string;
}

function stripQuotes(value: string): string {
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }
  return next.trim();
}

function readYamlField(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return undefined;
  const value = stripQuotes(match[1] ?? "");
  return value || undefined;
}

/** Extract known site front matter fields from a markdown note. */
export function parseSiteFrontmatter(markdown: string): SiteFrontmatter {
  if (!markdown.startsWith("---")) return {};
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) return {};
  const yaml = markdown.slice(3, end).replace(/^\r?\n/, "");
  return {
    title: readYamlField(yaml, "title"),
    lang: readYamlField(yaml, "lang"),
    translationKey: readYamlField(yaml, "translationKey"),
  };
}

/** Extract display title from YAML front matter `title` field. */
export function parseFrontmatterTitle(
  markdown: string,
  fallback: string,
): string {
  return parseSiteFrontmatter(markdown).title || fallback;
}
