export interface SiteConfig {
  siteName: string;
  siteDescription?: string;
  /**
   * Initial theme id (or legacy single-theme preference).
   * Prefer `lightTheme` / `darkTheme` for the published site pair.
   */
  defaultTheme: string;
  /** Theme id used when the site appearance is light. */
  lightTheme?: string;
  /** Theme id used when the site appearance is dark. */
  darkTheme?: string;
  /** Code highlight theme id for light appearance (builtin or custom-*). */
  lightCodeTheme?: string;
  /** Code highlight theme id for dark appearance (builtin or custom-*). */
  darkCodeTheme?: string;
  /** URL path prefix, e.g. `/repo/` or `/`. */
  baseHref: string;
  /** Output directory relative to vault root (default `dist`). */
  out: string;
  /** Relative path of home note within vault, e.g. `README.md`. */
  home?: string;
  /**
   * When true, the sidebar shows a link back to the marketing site root
   * (`index.html` / `en/index.html`), plus brand icon / favicon from the
   * landing overlay (`icon.png` / `favicon.png`). Enable when a `landing/`
   * overlay is published.
   */
  showSiteHome?: boolean;
  /**
   * Optional multilingual publishing.
   * When set, the site chrome shows a language switcher and filters the nav
   * tree to the active locale folder.
   */
  locales?: SiteLocalesConfig;
}

export type SiteAppearance = "light" | "dark";

export interface ResolvedSiteThemes {
  lightTheme: string;
  darkTheme: string;
  defaultAppearance: SiteAppearance;
}

function pickThemeId(id: string | undefined, fallback: string, available: string[]): string {
  if (id && available.includes(id)) return id;
  if (available.includes(fallback)) return fallback;
  return available[0] ?? fallback;
}

/** Resolve the light/dark theme pair for a published site (with legacy defaults). */
export function resolveSiteThemePair(
  config: Pick<SiteConfig, "defaultTheme" | "lightTheme" | "darkTheme">,
  availableIds: string[] = [
    "light",
    "grey",
    "slate",
    "claude-code",
    "mint",
    "purple",
    "hermes",
    "ocean",
    "dark-modern",
    "cursor",
    "dracula",
  ],
): ResolvedSiteThemes {
  const available = availableIds.length ? availableIds : ["light", "ocean"];
  let lightTheme = pickThemeId(config.lightTheme, "light", available);
  let darkTheme = pickThemeId(config.darkTheme, "ocean", available);

  if (!config.lightTheme && !config.darkTheme && config.defaultTheme) {
    if (/dark|ocean|cursor|dracula/i.test(config.defaultTheme)) {
      darkTheme = pickThemeId(config.defaultTheme, darkTheme, available);
    } else {
      lightTheme = pickThemeId(config.defaultTheme, lightTheme, available);
    }
  }

  const defaultAppearance: SiteAppearance =
    config.defaultTheme === darkTheme ||
    /dark|ocean|cursor|dracula/i.test(config.defaultTheme || "")
      ? "dark"
      : "light";

  return { lightTheme, darkTheme, defaultAppearance };
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: "Notes",
  defaultTheme: "ocean",
  lightTheme: "light",
  darkTheme: "ocean",
  lightCodeTheme: "github-light",
  darkCodeTheme: "github-dark",
  baseHref: "/",
  out: "dist",
};


/** One language offered by a published site. */
export interface SiteLocaleLanguage {
  /** Short id used in front matter `lang`, e.g. `zh` / `en`. */
  id: string;
  /** Label shown in the language switcher. */
  label: string;
  /** Vault-relative folder root for this locale, e.g. `zh`. */
  root: string;
  /**
   * Optional home note for this locale (vault-relative markdown path).
   * Used when switching language without a paired translation.
   */
  home?: string;
}

export interface SiteLocalesConfig {
  /** Default language id when a page has no `lang`. */
  default: string;
  languages: SiteLocaleLanguage[];
}

export interface ManifestNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  href?: string;
  children?: ManifestNode[];
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

/** A resolved wiki link shown below the article. */
export interface SiteLinkItem {
  title: string;
  /** Relative href from the current page HTML. */
  href: string;
  sourcePath: string;
}

/** One node in the published local relationship graph. */
export interface SiteGraphNode {
  id: string;
  label: string;
  href: string;
  center?: boolean;
}

export interface SiteGraphEdge {
  source: string;
  target: string;
}

/** 1-hop neighborhood around the current note for the site graph canvas. */
export interface SiteGraphPayload {
  centerId: string;
  nodes: SiteGraphNode[];
  edges: SiteGraphEdge[];
}

export interface BuiltPage {
  /** Vault-relative markdown path, forward slashes. */
  sourcePath: string;
  /** Site-relative HTML path under out, e.g. `notes/foo.html`. */
  htmlPath: string;
  title: string;
  bodyHtml: string;
  outline: OutlineItem[];
  outlinks: SiteLinkItem[];
  backlinks: SiteLinkItem[];
  /** Local graph (center + 1-hop neighbors). */
  graph: SiteGraphPayload;
  /** Locale id from front matter or inferred from path. */
  lang?: string;
  /** Shared key pairing translations across languages. */
  translationKey?: string;
}

export interface MediaCopyPlan {
  /** Absolute filesystem path of the source file. */
  from: string;
  /** Path relative to out dir, e.g. `media/images/a.png`. */
  to: string;
}

export interface SiteFile {
  path: string;
  content: string;
}

export interface SiteBuildResult {
  files: SiteFile[];
  media: MediaCopyPlan[];
  outRelative: string;
  pageCount: number;
}
