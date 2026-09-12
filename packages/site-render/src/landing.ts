import type { MediaCopyPlan, SiteBuildResult, SiteFile } from "./types.ts";

/** Vault folder that holds marketing landing HTML/CSS/JS (when present). */
export const LANDING_DIR_NAME = "landing";

/** Placeholder replaced with the app/docs package version at build time. */
export const LANDING_VERSION_PLACEHOLDER = "{{INIMARK_VERSION}}";

/** Screenshot filenames copied from vault `assets/` into site `assets/`. */
export const LANDING_SHOT_NAMES = [
  "note-light.png",
  "note-dark.png",
  "graph-light.png",
  "graph-dark.png",
  "outline-light.png",
  "outline-dark.png",
  "setting-light.png",
  "setting-dark.png",
] as const;

/** Text assets shipped next to the landing HTML at the site root. */
export const LANDING_STATIC_TEXT_FILES = [
  "site-topbar.css",
  "site-theme.css",
  "site-theme.js",
] as const;

export const LANDING_STATIC_BINARY_FILES = ["icon.png", "favicon.png"] as const;

/**
 * Pre-loaded marketing landing inputs (Node or Tauri readers fill this).
 * Pure overlay — no filesystem I/O here.
 */
export interface MarketingLandingBundle {
  /** Chinese landing HTML (becomes site root `index.html`). */
  zhHtml: string;
  /** English landing HTML (becomes `en/index.html`), if present. */
  enHtml: string | null;
  /** Root-relative text files (CSS/JS). */
  staticFiles: SiteFile[];
  /** Binary copies (screenshots, icons). */
  media: MediaCopyPlan[];
  /** Version string injected into `{{INIMARK_VERSION}}`. */
  version: string;
}

export interface LoadMarketingLandingBundleOptions {
  /** Absolute vault root (e.g. `…/docs`). */
  vaultPath: string;
  /** Version injected into the landing HTML. */
  version: string;
  /** Join path segments into an absolute filesystem path. */
  joinPath: (...segments: string[]) => string;
  exists: (absPath: string) => boolean | Promise<boolean>;
  readText: (absPath: string) => string | Promise<string>;
  /** Fallback when `landing/icon.png` is missing. */
  fallbackIconPath?: string;
}

function upsertFile(files: SiteFile[], path: string, content: string): SiteFile[] {
  const next = files.filter((f) => f.path !== path);
  next.push({ path, content });
  return next;
}

function injectVersion(html: string, version: string): string {
  return html.split(LANDING_VERSION_PLACEHOLDER).join(version);
}

/**
 * Replace the SSG root redirect with a marketing homepage and attach
 * landing static/media assets. Returns a new build result (does not mutate).
 */
export function applyMarketingLanding(
  built: SiteBuildResult,
  bundle: MarketingLandingBundle,
): SiteBuildResult {
  let files = [...built.files];
  files = upsertFile(files, "index.html", injectVersion(bundle.zhHtml, bundle.version));
  if (bundle.enHtml != null) {
    files = upsertFile(
      files,
      "en/index.html",
      injectVersion(bundle.enHtml, bundle.version),
    );
  }
  for (const file of bundle.staticFiles) {
    files = upsertFile(files, file.path, file.content);
  }

  const mediaSeen = new Set(built.media.map((m) => m.to));
  const media = [...built.media];
  for (const item of bundle.media) {
    if (mediaSeen.has(item.to)) continue;
    mediaSeen.add(item.to);
    media.push(item);
  }

  return {
    ...built,
    files,
    media,
  };
}

/**
 * Load vault `landing/` when `landing/index.html` exists.
 * IO is injected so CLI (Node) and Dev Publish (Tauri) share one code path.
 */
export async function loadMarketingLandingBundle(
  options: LoadMarketingLandingBundleOptions,
): Promise<MarketingLandingBundle | null> {
  const { vaultPath, version, joinPath, exists, readText, fallbackIconPath } = options;
  const landingDir = joinPath(vaultPath, LANDING_DIR_NAME);
  const zhPath = joinPath(landingDir, "index.html");
  if (!(await exists(zhPath))) return null;

  const zhHtml = await readText(zhPath);
  const enPath = joinPath(landingDir, "en", "index.html");
  const enHtml = (await exists(enPath)) ? await readText(enPath) : null;

  const staticFiles: SiteFile[] = [];
  for (const name of LANDING_STATIC_TEXT_FILES) {
    const abs = joinPath(landingDir, name);
    if (!(await exists(abs))) continue;
    staticFiles.push({ path: name, content: await readText(abs) });
  }

  const media: MediaCopyPlan[] = [];
  for (const name of LANDING_STATIC_BINARY_FILES) {
    let abs = joinPath(landingDir, name);
    if (!(await exists(abs)) && name === "icon.png" && fallbackIconPath) {
      abs = fallbackIconPath;
    }
    if (!(await exists(abs)) && name === "favicon.png") {
      const icon = joinPath(landingDir, "icon.png");
      abs = (await exists(icon)) ? icon : (fallbackIconPath ?? abs);
    }
    if (!(await exists(abs))) continue;
    media.push({ from: abs, to: name });
  }

  const shotsDir = joinPath(vaultPath, "assets");
  for (const name of LANDING_SHOT_NAMES) {
    const abs = joinPath(shotsDir, name);
    if (!(await exists(abs))) continue;
    media.push({ from: abs, to: `assets/${name}` });
  }

  return {
    zhHtml,
    enHtml,
    staticFiles,
    media,
    version,
  };
}
