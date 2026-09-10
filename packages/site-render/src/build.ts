import {
  renderMarkdownToStaticHtml,
  setWikiLinkBridge,
  type WikiLinkBridge,
} from "@inimark/editor";

import { SITE_JS, SITE_LAYOUT_CSS } from "./assets.ts";
import { parseFrontmatterTitle } from "./frontmatter.ts";
import {
  isAbsoluteFsPath,
  isLocalAssetSrc,
  mediaOutPath,
  noteHtmlPath,
  noteTitleFromPath,
  normalizeSlashes,
  relativeHref,
  stripFileUrl,
} from "./paths.ts";
import { packSiteCss } from "./theme.ts";
import { renderIndexRedirect, renderNotePage } from "./template.ts";
import type {
  BuiltPage,
  ManifestNode,
  MediaCopyPlan,
  SiteBuildResult,
  SiteConfig,
  SiteFile,
} from "./types.ts";
import { DEFAULT_SITE_CONFIG } from "./types.ts";

export interface VaultNoteInput {
  /** Vault-relative path with forward slashes. */
  path: string;
  markdown: string;
}

export interface BuildSiteOptions {
  config?: Partial<SiteConfig>;
  notes: VaultNoteInput[];
  /** Optional tree for sidebar; if omitted, a flat file list is used. */
  tree?: ManifestNode[];
  /**
   * Resolve a wiki note name to a vault-relative markdown path
   * (same rules as the editor link index).
   */
  resolveNotePath: (noteName: string) => string | null | undefined;
  /**
   * Map a vault-relative media path to an absolute filesystem path for copying.
   * Return null to skip.
   */
  resolveMediaAbsolutePath: (vaultRelativePath: string) => string | null | undefined;
  /** Raw CSS: themes.css (with [data-theme] blocks) + optional custom themes. */
  themeVariablesCss: string;
  editorWidgetsCss: string;
  editorThemeCss: string;
  /** Theme ids offered in the site picker. */
  themeIds: string[];
}

function headingSlug(heading: string): string {
  return (
    heading
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-|-$/g, "") || "heading"
  );
}

function installWikiBridge(
  resolveNotePath: BuildSiteOptions["resolveNotePath"],
): () => void {
  const previous = null;
  const bridge: WikiLinkBridge = {
    resolveNote(noteName: string) {
      return resolveNotePath(noteName) ?? null;
    },
    resolveImage() {
      return null;
    },
    searchNotes() {
      return [];
    },
    openNote() {},
  };
  setWikiLinkBridge(bridge);
  return () => setWikiLinkBridge(previous);
}

function buildFlatManifest(
  notes: VaultNoteInput[],
  titleByPath: Map<string, string>,
): ManifestNode[] {
  return notes
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((n) => ({
      name: titleByPath.get(normalizeSlashes(n.path)) ?? noteTitleFromPath(n.path),
      path: n.path,
      kind: "file" as const,
      href: noteHtmlPath(n.path),
    }));
}

/** Attach hrefs and display titles to file nodes for the site sidebar. */
export function annotateManifestTree(
  nodes: ManifestNode[],
  titleByPath: Map<string, string> = new Map(),
): ManifestNode[] {
  return nodes.map((node) => {
    if (node.kind === "directory") {
      return {
        ...node,
        children: annotateManifestTree(node.children ?? [], titleByPath),
      };
    }
    if (/\.(md|markdown|mdown)$/i.test(node.path)) {
      const path = normalizeSlashes(node.path);
      return {
        ...node,
        name: titleByPath.get(path) ?? noteTitleFromPath(path),
        href: noteHtmlPath(path),
      };
    }
    return node;
  });
}

function pickHome(notes: VaultNoteInput[], config: SiteConfig): VaultNoteInput {
  if (config.home) {
    const home = normalizeSlashes(config.home);
    const found = notes.find((n) => normalizeSlashes(n.path) === home);
    if (found) return found;
  }
  const readme = notes.find((n) =>
    /(^|\/)readme\.md$/i.test(normalizeSlashes(n.path)),
  );
  if (readme) return readme;
  return notes.slice().sort((a, b) => a.path.localeCompare(b.path))[0]!;
}

/**
 * Build a complete static site artifact (HTML/CSS/JS + media copy plan).
 * Runs in a DOM environment (Tauri webview or happy-dom).
 */
export function buildSite(options: BuildSiteOptions): SiteBuildResult {
  const config: SiteConfig = { ...DEFAULT_SITE_CONFIG, ...options.config };
  if (!options.notes.length) {
    throw new Error("No markdown notes to publish.");
  }

  const noteByPath = new Map(
    options.notes.map((n) => [normalizeSlashes(n.path), n]),
  );

  const resolveWikiHref = (fromSource: string) => {
    return (noteName: string, heading?: string) => {
      const target = options.resolveNotePath(noteName);
      if (!target || !noteByPath.has(normalizeSlashes(target))) {
        return { href: "#", unresolved: true };
      }
      const fromHtml = noteHtmlPath(fromSource);
      const toHtml = noteHtmlPath(target);
      let href = relativeHref(fromHtml, toHtml);
      if (heading) href += `#${headingSlug(heading)}`;
      return { href, unresolved: false };
    };
  };

  const media: MediaCopyPlan[] = [];
  const mediaSeen = new Set<string>();
  const pages: BuiltPage[] = [];

  for (const note of options.notes) {
    const restore = installWikiBridge(options.resolveNotePath);
    try {
      const rewriteSrc = (src: string): string | null => {
        if (!isLocalAssetSrc(src)) return null;
        const cleaned = stripFileUrl(src);
        const outRel = mediaOutPath(cleaned, note.path);

        let sourcePath: string;
        if (isAbsoluteFsPath(cleaned)) {
          sourcePath = cleaned;
        } else {
          const noteDir = normalizeSlashes(note.path).split("/").slice(0, -1).join("/");
          let vaultRel = normalizeSlashes(cleaned);
          if (noteDir) vaultRel = `${noteDir}/${vaultRel}`;
          const parts: string[] = [];
          for (const seg of vaultRel.split("/")) {
            if (!seg || seg === ".") continue;
            if (seg === "..") {
              parts.pop();
              continue;
            }
            parts.push(seg);
          }
          sourcePath = parts.join("/");
        }

        const abs = options.resolveMediaAbsolutePath(sourcePath);
        if (abs && !mediaSeen.has(outRel)) {
          mediaSeen.add(outRel);
          media.push({ from: abs, to: outRel });
        }
        return relativeHref(noteHtmlPath(note.path), outRel);
      };

      const exported = renderMarkdownToStaticHtml(note.markdown, {
        rewriteSrc,
        resolveWikiHref: resolveWikiHref(note.path),
      });

      const fallbackTitle = noteTitleFromPath(note.path);
      const title = parseFrontmatterTitle(note.markdown, fallbackTitle);

      pages.push({
        sourcePath: note.path,
        htmlPath: noteHtmlPath(note.path),
        title,
        bodyHtml: exported.html,
        outline: exported.outline,
      });
    } finally {
      restore();
    }
  }

  const titleByPath = new Map(
    pages.map((p) => [normalizeSlashes(p.sourcePath), p.title]),
  );

  const manifest = annotateManifestTree(
    options.tree?.length ? options.tree : buildFlatManifest(options.notes, titleByPath),
    titleByPath,
  );

  const siteCss = packSiteCss({
    layoutCss: SITE_LAYOUT_CSS,
    themeVariablesCss: options.themeVariablesCss,
    editorWidgetsCss: options.editorWidgetsCss,
    editorThemeCss: options.editorThemeCss,
  });

  const files: SiteFile[] = [
    { path: "assets/site.css", content: siteCss },
    { path: "assets/site.js", content: SITE_JS },
    {
      path: "assets/manifest.json",
      content: JSON.stringify({ siteName: config.siteName, tree: manifest }, null, 2),
    },
  ];

  for (const page of pages) {
    files.push({
      path: page.htmlPath,
      content: renderNotePage({
        config,
        page,
        manifest,
        themes: options.themeIds,
      }),
    });
  }

  const home = pickHome(options.notes, config);
  files.push({
    path: "index.html",
    content: renderIndexRedirect({
      config,
      homeHtmlPath: noteHtmlPath(home.path),
    }),
  });

  return {
    files,
    media,
    outRelative: config.out || "dist",
    pageCount: pages.length,
  };
}
