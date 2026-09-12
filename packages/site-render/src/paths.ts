/** Path helpers for site URLs (always forward slashes). */

export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function ensureTrailingSlash(base: string): string {
  if (!base || base === "/") return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function joinUrl(baseHref: string, rel: string): string {
  const base = ensureTrailingSlash(baseHref);
  const clean = normalizeSlashes(rel).replace(/^\//, "");
  if (base === "/") return `/${clean}`;
  return `${base}${clean}`;
}

/** `folder/note.md` → `docs/folder/note.html` (site docs URL prefix). */
export function noteHtmlPath(sourcePath: string): string {
  const norm = normalizeSlashes(sourcePath).replace(/^\.\//, "");
  const withoutExt = norm.replace(/\.(md|markdown|mdown)$/i, "");
  return `docs/${withoutExt}.html`;
}

export function noteTitleFromPath(sourcePath: string): string {
  const norm = normalizeSlashes(sourcePath);
  const base = norm.split("/").pop() ?? norm;
  return base.replace(/\.(md|markdown|mdown)$/i, "");
}

/** Relative path from one site HTML file to another. */
export function relativeHref(fromHtmlPath: string, toHtmlPath: string): string {
  const fromParts = normalizeSlashes(fromHtmlPath).split("/");
  fromParts.pop();
  const toParts = normalizeSlashes(toHtmlPath).split("/");
  let i = 0;
  while (
    i < fromParts.length &&
    i < toParts.length &&
    fromParts[i] === toParts[i]
  ) {
    i++;
  }
  const ups = fromParts.length - i;
  const prefix = ups > 0 ? "../".repeat(ups) : "";
  const rest = toParts.slice(i).join("/");
  return prefix + rest || "./";
}

/** Windows drive path or POSIX absolute path. */
export function isAbsoluteFsPath(path: string): boolean {
  const n = normalizeSlashes(path);
  return /^[A-Za-z]:\//.test(n) || n.startsWith("/");
}

/** Strip `file://` / `file:///` so we can treat local file URLs as paths. */
export function stripFileUrl(src: string): string {
  const raw = src.trim();
  if (!/^file:/i.test(raw)) return normalizeSlashes(raw);
  try {
    const url = new URL(raw);
    let pathname = decodeURIComponent(url.pathname);
    // file:///C:/Users/... → /C:/Users/... on some runtimes; normalize to C:/...
    if (/^\/[A-Za-z]:\//.test(pathname)) pathname = pathname.slice(1);
    return normalizeSlashes(pathname);
  } catch {
    return normalizeSlashes(
      raw.replace(/^file:\/\//i, "").replace(/^\/([A-Za-z]:\/)/, "$1"),
    );
  }
}

/**
 * Map an image src to a safe path under `media/` inside the site output.
 * Absolute paths go under `media/ext/...` (drive letter becomes a folder).
 */
export function mediaOutPath(originalSrc: string, noteSourcePath: string): string {
  const noteDir = normalizeSlashes(noteSourcePath).split("/").slice(0, -1).join("/");
  let resolved = stripFileUrl(originalSrc);

  if (isAbsoluteFsPath(resolved)) {
    let rest = resolved;
    if (/^[A-Za-z]:\//.test(rest)) {
      // C:/Users/a.png → C/Users/a.png
      rest = `${rest[0]}${rest.slice(2)}`;
    } else {
      rest = rest.replace(/^\//, "");
    }
    const parts: string[] = [];
    for (const seg of rest.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        parts.pop();
        continue;
      }
      parts.push(seg.replace(/[:*?"<>|]/g, "_"));
    }
    return `media/ext/${parts.join("/")}`;
  }

  if (noteDir) resolved = `${noteDir}/${resolved}`;

  const parts: string[] = [];
  for (const seg of resolved.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg.replace(/[:*?"<>|]/g, "_"));
  }
  return `media/${parts.join("/")}`;
}

export function isLocalAssetSrc(src: string): boolean {
  if (!src) return false;
  if (/^(https?:|data:|blob:|mailto:|#)/i.test(src)) return false;
  return true;
}
