/** Normalize to vault-relative forward-slash paths without leading `./`. */
export function normalizeVaultPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

const NOTE_EXT = /\.(md|markdown|mdown|txt)$/i;

/** True when the file name is an Inimark-editable note. */
export function isNoteFileName(name: string): boolean {
  return NOTE_EXT.test(name);
}

/**
 * Split a note path into Pure Writer folder / category / title / extension.
 *
 * Mapping:
 * - `Note.md` → folder=default, no category, title=Note
 * - `Folder/Note.md` → folder=Folder, no category
 * - `Folder/Cat/Note.md` → folder=Folder, category=Cat
 * - `Folder/a/b/Note.md` → folder=Folder, category=`a/b`
 */
export function splitNotePath(path: string): {
  folderName: string | null;
  categoryName: string | null;
  title: string;
  extension: string;
} {
  const norm = normalizeVaultPath(path);
  const parts = norm.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("empty note path");
  }

  const fileName = parts[parts.length - 1]!;
  const match = fileName.match(/^(.*)\.(md|markdown|mdown|txt)$/i);
  if (!match) {
    throw new Error(`not a note file: ${path}`);
  }

  const title = match[1]!;
  const rawExt = match[2]!.toLowerCase();
  const extension = rawExt === "md" || rawExt === "markdown" || rawExt === "mdown" ? "md" : "txt";

  if (parts.length === 1) {
    return { folderName: null, categoryName: null, title, extension };
  }

  const folderName = parts[0]!;
  if (parts.length === 2) {
    return { folderName, categoryName: null, title, extension };
  }

  const categoryName = parts.slice(1, -1).join("/");
  return { folderName, categoryName, title, extension };
}

/** Build a vault-relative note path from Pure Writer placement fields. */
export function joinNotePath(parts: {
  folderName: string;
  categoryName: string | null | undefined;
  title: string;
  extension: string;
}): string {
  const ext = parts.extension.toLowerCase() === "md" ? "md" : "txt";
  const file = `${parts.title}.${ext}`;
  if (parts.categoryName) {
    return normalizeVaultPath(`${parts.folderName}/${parts.categoryName}/${file}`);
  }
  return normalizeVaultPath(`${parts.folderName}/${file}`);
}

/**
 * FNV-1a 32-bit hash → zero-padded hex (Pure Writer style short ids).
 * Not cryptographic; only needs stable, compact identifiers.
 */
export function hashHex(input: string, length = 12): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  // Mix a second pass over length-extended string for longer ids.
  let hash2 = 0x811c9dc5;
  const extended = `${input}\0${length}`;
  for (let i = 0; i < extended.length; i++) {
    hash2 ^= extended.charCodeAt(i);
    hash2 = Math.imul(hash2, 0x01000193);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}`.slice(0, length);
}

/** Pure Writer `orderKey` style zero-padded rank key. */
export function formatOrderKey(rankIndex: number): string {
  // Matches observed values like 000000000001000000
  const n = Math.max(0, Math.floor(rankIndex));
  return String(n).padStart(12, "0") + "000000";
}

/** Build a one-line summary similar to Pure Writer previews. */
export function buildSummary(content: string, maxLen = 120): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen - 1)}…`;
}
