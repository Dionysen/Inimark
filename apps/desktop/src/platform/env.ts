const MD_FILE = /\.(md|markdown|mdown)$/i;

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

export function joinWorkspacePath(root: string, relative: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  const normalizedRoot = root.replace(/[/\\]+$/, "");
  const normalizedRel = relative.replace(/^[/\\]+/, "").replace(/\//g, sep);
  return `${normalizedRoot}${sep}${normalizedRel}`;
}

export function isMarkdownFile(name: string): boolean {
  return MD_FILE.test(name);
}
