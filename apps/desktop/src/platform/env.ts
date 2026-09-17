export {
  documentFormatFromPath,
  isEditableNoteFile,
  isMarkdownFile,
  isPlainTextFile,
} from "@inimark/editor";
export type { DocumentFormat } from "@inimark/editor";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

/** Parent directory of a vault-relative path, or "" for root-level files. */
export function parentDirFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx > 0 ? normalized.slice(0, idx) : "";
}

export function joinWorkspacePath(root: string, relative: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  const normalizedRoot = root.replace(/[/\\]+$/, "");
  const normalizedRel = relative.replace(/^[/\\]+/, "").replace(/\//g, sep);
  return `${normalizedRoot}${sep}${normalizedRel}`;
}
