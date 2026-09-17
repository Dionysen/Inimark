/** Editable note formats recognized by file extension. */
export type DocumentFormat = "markdown" | "plaintext";

const MD_FILE = /\.(md|markdown|mdown)$/i;
const TXT_FILE = /\.txt$/i;

/** True for Markdown notes (wiki / tags / publish / format-on-save). */
export function isMarkdownFile(name: string): boolean {
  return MD_FILE.test(name);
}

/** True for plain-text notes (typography only; no Markdown features). */
export function isPlainTextFile(name: string): boolean {
  return TXT_FILE.test(name);
}

/** True for files that appear in the vault tree and can open in the editor. */
export function isEditableNoteFile(name: string): boolean {
  return isMarkdownFile(name) || isPlainTextFile(name);
}

/**
 * Resolve document format from a path or file name.
 * Returns `null` when the extension is not an editable note.
 */
export function documentFormatFromPath(pathOrName: string): DocumentFormat | null {
  const base = pathOrName.replace(/\\/g, "/");
  const slash = base.lastIndexOf("/");
  const name = slash >= 0 ? base.slice(slash + 1) : base;
  if (isMarkdownFile(name)) return "markdown";
  if (isPlainTextFile(name)) return "plaintext";
  return null;
}
