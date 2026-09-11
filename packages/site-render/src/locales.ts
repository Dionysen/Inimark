import type { ManifestNode, SiteLocalesConfig } from "./types.ts";
import { normalizeSlashes } from "./paths.ts";

/** Whether a vault-relative path sits under a locale root folder. */
export function pathLocaleRoot(
  path: string,
  locales: SiteLocalesConfig,
): string | null {
  const norm = normalizeSlashes(path);
  for (const lang of locales.languages) {
    const root = normalizeSlashes(lang.root).replace(/\/$/, "");
    if (norm === root || norm.startsWith(`${root}/`)) return root;
  }
  return null;
}

/**
 * Infer lang id from path when front matter omits `lang`
 * (first matching locale root wins).
 */
export function inferLangFromPath(
  path: string,
  locales: SiteLocalesConfig | undefined,
): string | undefined {
  if (!locales?.languages.length) return undefined;
  const norm = normalizeSlashes(path);
  for (const lang of locales.languages) {
    const root = normalizeSlashes(lang.root).replace(/\/$/, "");
    if (norm === root || norm.startsWith(`${root}/`)) return lang.id;
  }
  return undefined;
}

/**
 * Filter the sidebar to the active locale's *contents* (unwrap `zh/` / `en/` roots).
 * Other locale folders and shared hub notes outside locale roots are omitted.
 * Missing `pageLang` falls back to `locales.default`.
 */
export function filterManifestForLocale(
  tree: ManifestNode[],
  locales: SiteLocalesConfig | undefined,
  pageLang: string | undefined,
): ManifestNode[] {
  if (!locales?.languages.length) return tree;
  const active =
    locales.languages.find((l) => l.id === pageLang)?.id ?? locales.default;
  const activeRoot = normalizeSlashes(
    locales.languages.find((l) => l.id === active)?.root ?? "",
  ).replace(/\/$/, "");
  if (!activeRoot) return tree;

  for (const node of tree) {
    const path = normalizeSlashes(node.path).replace(/\/$/, "");
    if (path === activeRoot && node.kind === "directory") {
      return node.children ?? [];
    }
  }

  // Flat / partial trees: keep only nodes that live under the active root.
  return tree.filter((node) => {
    const path = normalizeSlashes(node.path).replace(/\/$/, "");
    return path === activeRoot || path.startsWith(`${activeRoot}/`);
  });
}

/** True when a vault path sits under any configured locale root. */
export function isUnderLocaleRoot(
  path: string,
  locales: SiteLocalesConfig | undefined,
): boolean {
  if (!locales?.languages.length) return true;
  return pathLocaleRoot(path, locales) !== null;
}

export interface LocaleMapEntry {
  /** lang id → site-relative html path */
  [langId: string]: string;
}

export type LocaleMap = Record<string, LocaleMapEntry>;

/** Build translationKey → { lang: htmlPath } from page metadata. */
export function buildLocaleMap(
  pages: Array<{
    translationKey?: string;
    lang?: string;
    htmlPath: string;
  }>,
): LocaleMap {
  const map: LocaleMap = {};
  for (const page of pages) {
    const key = page.translationKey?.trim();
    const lang = page.lang?.trim();
    if (!key || !lang) continue;
    if (!map[key]) map[key] = {};
    map[key]![lang] = page.htmlPath;
  }
  return map;
}
