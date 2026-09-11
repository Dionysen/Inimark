import type {
  BuiltPage,
  ManifestNode,
  OutlineItem,
  ResolvedSiteThemes,
  SiteConfig,
  SiteLinkItem,
} from "./types.ts";
import type { LocaleMap } from "./locales.ts";
import { joinUrl, relativeHref } from "./paths.ts";
import { SITE_THEME_BOOT_JS, SITE_TREE_BOOT_JS } from "./assets.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOutline(outline: OutlineItem[]): string {
  if (!outline.length) {
    return `<p class="site-rail-empty">No headings</p>`;
  }
  return `<ul class="site-outline-list">${outline
    .map(
      (item) =>
        `<li class="site-outline-item level-${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`,
    )
    .join("")}</ul>`;
}

function renderLinkList(items: SiteLinkItem[], emptyLabel: string): string {
  if (!items.length) {
    return `<p class="site-rail-empty">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<ul class="site-links-list">${items
    .map(
      (item) =>
        `<li class="site-links-item"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></li>`,
    )
    .join("")}</ul>`;
}

function renderLinksFooter(page: BuiltPage): string {
  return `<section class="site-links-footer" aria-label="Links">
      <h2 class="site-links-footer-title">Links</h2>
      <div class="site-links-footer-grid">
        <div class="site-links-group">
          <div class="site-links-subtitle">Outgoing <span class="site-links-count">${page.outlinks.length}</span></div>
          ${renderLinkList(page.outlinks, "No outgoing links")}
        </div>
        <div class="site-links-group">
          <div class="site-links-subtitle">Backlinks <span class="site-links-count">${page.backlinks.length}</span></div>
          ${renderLinkList(page.backlinks, "No backlinks")}
        </div>
      </div>
    </section>`;
}

function renderGraphPanel(page: BuiltPage): string {
  const payload = JSON.stringify(page.graph).replace(/</g, "\\u003c");
  const globalHref = relativeHref(page.htmlPath, "assets/graph.json");
  const localIcon =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="5" cy="7" r="2" fill="currentColor" opacity=".85"/><circle cx="19" cy="8" r="2" fill="currentColor" opacity=".85"/><circle cx="7" cy="18" r="2" fill="currentColor" opacity=".85"/><circle cx="18" cy="17" r="2" fill="currentColor" opacity=".85"/><path d="M9.2 9.2L10.8 10.8M14.8 10.2L16.8 9M9.6 14.8L8.2 16.4M14.2 14.2L16.2 15.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const globalIcon =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5S9.6 6.1 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  return `<section class="site-graph" aria-label="Graph">
      <div class="site-graph-head">
        <div class="site-rail-title">Graph</div>
        <div class="site-graph-actions">
          <button type="button" class="site-graph-btn" data-graph-mode="local" title="Local graph" aria-label="Open local graph">${localIcon}</button>
          <button type="button" class="site-graph-btn" data-graph-mode="global" title="Global graph" aria-label="Open global graph">${globalIcon}</button>
        </div>
      </div>
      <div class="site-graph-host" data-graph-preview data-page-html="${escapeHtml(page.htmlPath)}" data-global-graph="${escapeHtml(globalHref)}">
        <canvas class="site-graph-canvas" width="320" height="280" aria-label="Local relationship graph"></canvas>
        <script type="application/json" class="site-graph-data">${payload}</script>
      </div>
    </section>`;
}

function renderLangSwitcher(options: {
  config: SiteConfig;
  page: BuiltPage;
  localeMap: LocaleMap;
  localeHomeHtml: Map<string, string>;
}): string {
  const locales = options.config.locales;
  if (!locales?.languages.length) return "";

  const { page, localeMap, localeHomeHtml } = options;
  const active = page.lang || locales.default;
  const pair = page.translationKey ? localeMap[page.translationKey] : undefined;

  const buttons = locales.languages
    .map((lang) => {
      const targetHtml =
        pair?.[lang.id] ?? localeHomeHtml.get(lang.id) ?? null;
      const href = targetHtml
        ? relativeHref(page.htmlPath, targetHtml)
        : relativeHref(page.htmlPath, "index.html");
      const isActive = lang.id === active;
      return `<a class="site-lang-btn${isActive ? " is-active" : ""}" href="${escapeHtml(href)}" data-lang="${escapeHtml(lang.id)}" hreflang="${escapeHtml(lang.id)}"${isActive ? ' aria-current="page"' : ""}>${escapeHtml(lang.label)}</a>`;
    })
    .join("");

  return `<div class="site-lang" role="navigation" aria-label="Language" data-translation-key="${escapeHtml(page.translationKey || "")}" data-lang="${escapeHtml(active)}">${buttons}</div>`;
}

function treeContainsActive(node: ManifestNode, currentHtmlPath: string): boolean {
  if (node.kind === "file") return node.href === currentHtmlPath;
  return (node.children ?? []).some((child) =>
    treeContainsActive(child, currentHtmlPath),
  );
}

function renderTree(
  nodes: ManifestNode[],
  currentHtmlPath: string,
  depth = 0,
): string {
  if (!nodes.length) return "";
  const chevronSvg =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<ul class="site-tree" data-depth="${depth}">${nodes
    .map((node) => {
      if (node.kind === "directory") {
        const expanded = treeContainsActive(node, currentHtmlPath);
        const kids = renderTree(node.children ?? [], currentHtmlPath, depth + 1);
        const kidsHtml = expanded
          ? kids
          : kids.replace(/^<ul /, '<ul hidden ');
        const chevronClass = expanded
          ? "site-tree-chevron is-expanded"
          : "site-tree-chevron";
        return `<li class="site-tree-dir${expanded ? "" : " is-collapsed"}" data-tree-path="${escapeHtml(node.path)}"><button type="button" class="site-tree-toggle" aria-expanded="${expanded ? "true" : "false"}"><span class="${chevronClass}" aria-hidden="true">${chevronSvg}</span><span class="site-tree-label">${escapeHtml(node.name)}</span></button>${kidsHtml}</li>`;
      }
      const href = node.href ?? "#";
      const active = node.href === currentHtmlPath ? " is-active" : "";
      const rel = relativeHref(currentHtmlPath, href);
      return `<li class="site-tree-file${active}"><a href="${escapeHtml(rel)}"><span class="site-tree-chevron-spacer" aria-hidden="true"></span><span class="site-tree-label">${escapeHtml(node.name)}</span></a></li>`;
    })
    .join("")}</ul>`;
}

export function renderNotePage(options: {
  config: SiteConfig;
  page: BuiltPage;
  manifest: ManifestNode[];
  themes: string[];
  themePair: ResolvedSiteThemes;
  localeMap?: LocaleMap;
  localeHomeHtml?: Map<string, string>;
  hasMermaidRuntime?: boolean;
}): string {
  const {
    config,
    page,
    manifest,
    themePair,
    localeMap = {},
    localeHomeHtml = new Map(),
    hasMermaidRuntime = false,
  } = options;
  const cssHref = relativeHref(page.htmlPath, "assets/site.css");
  const jsHref = relativeHref(page.htmlPath, "assets/site.js");
  const mermaidHref = relativeHref(page.htmlPath, "assets/mermaid.min.js");
  const langSwitcher = renderLangSwitcher({
    config,
    page,
    localeMap,
    localeHomeHtml,
  });
  const htmlLang = page.lang || config.locales?.default || "en";
  const brandTarget =
    (page.lang && localeHomeHtml.get(page.lang)) ||
    localeHomeHtml.get(config.locales?.default ?? "") ||
    "index.html";
  const brandHref = relativeHref(page.htmlPath, brandTarget);
  const mermaidScript = hasMermaidRuntime
    ? `  <script src="${escapeHtml(mermaidHref)}" defer data-inimark-mermaid></script>\n`
    : "";
  const initialTheme =
    themePair.defaultAppearance === "dark" ? themePair.darkTheme : themePair.lightTheme;
  const sunIcon =
    '<svg class="site-theme-icon site-theme-icon-sun" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
  const moonIcon =
    '<svg class="site-theme-icon site-theme-icon-moon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}" data-theme="${escapeHtml(initialTheme)}" data-appearance="${escapeHtml(themePair.defaultAppearance)}" data-theme-light="${escapeHtml(themePair.lightTheme)}" data-theme-dark="${escapeHtml(themePair.darkTheme)}"${page.lang ? ` data-page-lang="${escapeHtml(page.lang)}"` : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${SITE_THEME_BOOT_JS}</script>
  <title>${escapeHtml(page.title)} · ${escapeHtml(config.siteName)}</title>
  ${config.siteDescription ? `<meta name="description" content="${escapeHtml(config.siteDescription)}">` : ""}
  <link rel="stylesheet" href="${escapeHtml(cssHref)}">
</head>
<body class="site-body">
  <div class="site-layout">
    <aside class="site-sidebar" aria-label="Notes">
      <div class="site-sidebar-head">
        <div class="site-sidebar-head-row">
          <a class="site-brand" href="${escapeHtml(brandHref)}">${escapeHtml(config.siteName)}</a>
          <button type="button" class="site-theme-toggle" id="site-theme-toggle" aria-label="Toggle light and dark theme" title="Theme">
            ${sunIcon}${moonIcon}
          </button>
        </div>
        ${langSwitcher}
      </div>
      <nav class="site-nav">${renderTree(manifest, page.htmlPath)}</nav>
      <script>${SITE_TREE_BOOT_JS}</script>
    </aside>
    <main class="site-main">
      <article class="ProseMirror site-article">${page.bodyHtml}</article>
      ${renderLinksFooter(page)}
    </main>
    <aside class="site-rail" aria-label="Page tools">
      ${renderGraphPanel(page)}
      <section class="site-outline" aria-label="Outline">
        <div class="site-rail-title">Outline</div>
        ${renderOutline(page.outline)}
      </section>
    </aside>
  </div>
${mermaidScript}  <script src="${escapeHtml(jsHref)}" defer></script>
</body>
</html>
`;
}

export function renderIndexRedirect(options: {
  config: SiteConfig;
  homeHtmlPath: string;
}): string {
  const { config, homeHtmlPath } = options;
  const href = joinUrl(config.baseHref, homeHtmlPath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(homeHtmlPath)}">
  <link rel="canonical" href="${escapeHtml(href)}">
  <title>${escapeHtml(config.siteName)}</title>
  <script>location.replace(${JSON.stringify(homeHtmlPath)});</script>
</head>
<body>
  <p><a href="${escapeHtml(homeHtmlPath)}">${escapeHtml(config.siteName)}</a></p>
</body>
</html>
`;
}
