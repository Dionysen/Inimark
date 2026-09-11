import {
  renderMarkdownToStaticHtml,
  setWikiLinkBridge,
  type WikiLinkBridge,
} from "@inimark/editor";

import { SITE_JS, SITE_LAYOUT_CSS } from "./assets.ts";
import { parseSiteFrontmatter } from "./frontmatter.ts";
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
import {
  buildLocaleMap,
  filterManifestForLocale,
  inferLangFromPath,
  isUnderLocaleRoot,
} from "./locales.ts";
import { packSiteCss } from "./theme.ts";
import { renderIndexRedirect, renderNotePage } from "./template.ts";
import type {
  BuiltPage,
  ManifestNode,
  MediaCopyPlan,
  SiteBuildResult,
  SiteConfig,
  SiteFile,
  SiteGraphPayload,
  SiteLinkItem,
} from "./types.ts";
import { DEFAULT_SITE_CONFIG, resolveSiteThemePair } from "./types.ts";
import { parseWikiNoteTargets } from "./wiki-links.ts";

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
  /**
   * Optional Mermaid UMD bundle (`mermaid.min.js`) embedded as `assets/mermaid.min.js`.
   * Required for published ```mermaid fences to hydrate in the browser.
   */
  mermaidRuntimeJs?: string;
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
  if (config.locales?.languages.length) {
    const def =
      config.locales.languages.find((l) => l.id === config.locales!.default) ??
      config.locales.languages[0];
    if (def?.home) {
      const home = normalizeSlashes(def.home);
      const found = notes.find((n) => normalizeSlashes(n.path) === home);
      if (found) return found;
    }
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
  const baseConfig: SiteConfig = { ...DEFAULT_SITE_CONFIG, ...options.config };
  const themePair = resolveSiteThemePair(baseConfig, options.themeIds);
  const config: SiteConfig = {
    ...baseConfig,
    lightTheme: themePair.lightTheme,
    darkTheme: themePair.darkTheme,
    defaultTheme:
      themePair.defaultAppearance === "dark" ? themePair.darkTheme : themePair.lightTheme,
  };
  const notes = config.locales?.languages.length
    ? options.notes.filter((n) => isUnderLocaleRoot(n.path, config.locales))
    : options.notes;
  if (!notes.length) {
    throw new Error("No markdown notes to publish.");
  }

  const noteByPath = new Map(
    notes.map((n) => [normalizeSlashes(n.path), n]),
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

  for (const note of notes) {
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
      const fm = parseSiteFrontmatter(note.markdown);
      const title = fm.title || fallbackTitle;
      const lang =
        fm.lang || inferLangFromPath(note.path, config.locales) || undefined;
      const translationKey = fm.translationKey;

      pages.push({
        sourcePath: note.path,
        htmlPath: noteHtmlPath(note.path),
        title,
        bodyHtml: exported.html,
        outline: exported.outline,
        outlinks: [],
        backlinks: [],
        graph: { centerId: normalizeSlashes(note.path), nodes: [], edges: [] },
        lang,
        translationKey,
      });
    } finally {
      restore();
    }
  }

  const titleByPath = new Map(
    pages.map((p) => [normalizeSlashes(p.sourcePath), p.title]),
  );
  const pageByPath = new Map(
    pages.map((p) => [normalizeSlashes(p.sourcePath), p]),
  );

  /** Collect resolved wiki edges once, then attach out/back links per page. */
  const edges: Array<{ from: string; to: string }> = [];
  for (const note of notes) {
    const from = normalizeSlashes(note.path);
    const seen = new Set<string>();
    for (const link of parseWikiNoteTargets(note.markdown)) {
      const target = options.resolveNotePath(link.noteName);
      if (!target) continue;
      const to = normalizeSlashes(target);
      if (!pageByPath.has(to) || to === from) continue;
      const key = `${from}\0${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
  }

  const toLinkItem = (fromHtml: string, targetPath: string): SiteLinkItem => {
    const page = pageByPath.get(targetPath)!;
    return {
      title: titleByPath.get(targetPath) ?? noteTitleFromPath(targetPath),
      href: relativeHref(fromHtml, page.htmlPath),
      sourcePath: targetPath,
    };
  };

  /** Local graph = current note + 1-hop neighbors and edges among that set. */
  const buildLocalGraph = (centerPath: string, fromHtml: string): SiteGraphPayload => {
    const ids = new Set<string>([centerPath]);
    for (const edge of edges) {
      if (edge.from === centerPath) ids.add(edge.to);
      if (edge.to === centerPath) ids.add(edge.from);
    }
    const nodes = [...ids].map((id) => {
      const page = pageByPath.get(id)!;
      return {
        id,
        label: titleByPath.get(id) ?? noteTitleFromPath(id),
        href: id === centerPath ? "" : relativeHref(fromHtml, page.htmlPath),
        center: id === centerPath,
      };
    });
    const localEdges = edges
      .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
      .map((edge) => ({ source: edge.from, target: edge.to }));
    return { centerId: centerPath, nodes, edges: localEdges };
  };

  for (const page of pages) {
    const path = normalizeSlashes(page.sourcePath);
    const outTargets = edges.filter((e) => e.from === path).map((e) => e.to);
    const backSources = edges.filter((e) => e.to === path).map((e) => e.from);
    page.outlinks = outTargets.map((to) => toLinkItem(page.htmlPath, to));
    page.backlinks = backSources.map((from) => toLinkItem(page.htmlPath, from));
    page.graph = buildLocalGraph(path, page.htmlPath);
  }

  const manifest = annotateManifestTree(
    options.tree?.length ? options.tree : buildFlatManifest(notes, titleByPath),
    titleByPath,
  );

  const localeMap = buildLocaleMap(pages);
  const localeHomeHtml = new Map<string, string>();
  if (config.locales?.languages.length) {
    for (const lang of config.locales.languages) {
      if (lang.home) {
        localeHomeHtml.set(lang.id, noteHtmlPath(normalizeSlashes(lang.home)));
        continue;
      }
      // Fallback: first page in this locale by path order.
      const first = pages
        .filter((p) => p.lang === lang.id)
        .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))[0];
      if (first) localeHomeHtml.set(lang.id, first.htmlPath);
    }
  }

  const siteCss = packSiteCss({
    layoutCss: SITE_LAYOUT_CSS,
    themeVariablesCss: options.themeVariablesCss,
    editorWidgetsCss: options.editorWidgetsCss,
    editorThemeCss: options.editorThemeCss,
  });

  const globalGraph = {
    nodes: pages.map((p) => ({
      id: normalizeSlashes(p.sourcePath),
      label: p.title,
      htmlPath: p.htmlPath,
    })),
    edges: edges.map((e) => ({ source: e.from, target: e.to })),
  };

  const files: SiteFile[] = [
    { path: "assets/site.css", content: siteCss },
    {
      path: "assets/site.js",
      // Embed global graph so modal works without fetch (file:// / offline / Pages lag).
      content: `window.__INIMARK_GLOBAL_GRAPH__ = ${JSON.stringify(globalGraph)};\n${SITE_JS}`,
    },
    {
      path: "assets/manifest.json",
      content: JSON.stringify({ siteName: config.siteName, tree: manifest }, null, 2),
    },
    {
      path: "assets/graph.json",
      content: JSON.stringify(globalGraph, null, 2),
    },
  ];

  const hasMermaidRuntime = Boolean(options.mermaidRuntimeJs?.trim());
  if (hasMermaidRuntime) {
    files.push({
      path: "assets/mermaid.min.js",
      content: options.mermaidRuntimeJs!,
    });
  }
  if (config.locales?.languages.length) {
    files.push({
      path: "assets/locale-map.json",
      content: JSON.stringify(
        {
          default: config.locales.default,
          languages: config.locales.languages.map((l) => ({
            id: l.id,
            label: l.label,
            home: localeHomeHtml.get(l.id) ?? null,
          })),
          translations: localeMap,
        },
        null,
        2,
      ),
    });
  }

  for (const page of pages) {
    const pageManifest = filterManifestForLocale(manifest, config.locales, page.lang);
    files.push({
      path: page.htmlPath,
      content: renderNotePage({
        config,
        page,
        manifest: pageManifest,
        themes: options.themeIds,
        themePair,
        localeMap,
        localeHomeHtml,
        hasMermaidRuntime,
      }),
    });
  }

  const home = pickHome(notes, config);
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
