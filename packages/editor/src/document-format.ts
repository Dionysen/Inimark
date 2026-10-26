/** Editable note formats recognized by file extension. */
export type DocumentFormat = "markdown" | "plaintext";

const MD_FILE = /\.(md|markdown|mdown)$/i;
const TXT_FILE = /\.txt$/i;
/** Raster / vector images shown in the vault tree and image viewer. */
const IMAGE_FILE =
  /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|heic|heif|tiff?|apng|jfif|jxl)$/i;

/** True for Markdown notes (wiki / tags / publish / format-on-save). */
export function isMarkdownFile(name: string): boolean {
  return MD_FILE.test(name);
}

/** True for plain-text notes (typography only; no Markdown features). */
export function isPlainTextFile(name: string): boolean {
  return TXT_FILE.test(name);
}

/** True for image files that can open in the vault image viewer. */
export function isImageFile(name: string): boolean {
  return IMAGE_FILE.test(name);
}

/** True for files that open as editable text in the note editor. */
export function isEditableNoteFile(name: string): boolean {
  return isMarkdownFile(name) || isPlainTextFile(name);
}

/** True for files that appear in the vault file tree. */
export function isVaultVisibleFile(name: string): boolean {
  return isEditableNoteFile(name) || isImageFile(name);
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
