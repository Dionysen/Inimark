export interface SiteConfig {
  siteName: string;
  siteDescription?: string;
  /** Default theme id applied on first visit (light | grey | dark | custom-…). */
  defaultTheme: string;
  /** URL path prefix, e.g. `/repo/` or `/`. */
  baseHref: string;
  /** Output directory relative to vault root (default `dist`). */
  out: string;
  /** Relative path of home note within vault, e.g. `README.md`. */
  home?: string;
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

export interface BuiltPage {
  /** Vault-relative markdown path, forward slashes. */
  sourcePath: string;
  /** Site-relative HTML path under out, e.g. `notes/foo.html`. */
  htmlPath: string;
  title: string;
  bodyHtml: string;
  outline: OutlineItem[];
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

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: "Notes",
  defaultTheme: "dark",
  baseHref: "/",
  out: "dist",
};
