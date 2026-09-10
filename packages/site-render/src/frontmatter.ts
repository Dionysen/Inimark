/** Extract display title from YAML front matter `title` field. */

export function parseFrontmatterTitle(
  markdown: string,
  fallback: string,
): string {
  if (!markdown.startsWith("---")) return fallback;
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) return fallback;
  const yaml = markdown.slice(3, end).replace(/^\r?\n/, "");
  const match = yaml.match(/^title:\s*(.*)$/m);
  if (!match) return fallback;
  let value = match[1]!.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  value = value.trim();
  return value || fallback;
}
