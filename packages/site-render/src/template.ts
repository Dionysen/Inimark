import type { BuiltPage, ManifestNode, OutlineItem, SiteConfig } from "./types.ts";
import { joinUrl, relativeHref } from "./paths.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOutline(outline: OutlineItem[]): string {
  if (!outline.length) {
    return `<p class="site-outline-empty">No headings</p>`;
  }
  return `<ul class="site-outline-list">${outline
    .map(
      (item) =>
        `<li class="site-outline-item level-${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`,
    )
    .join("")}</ul>`;
}

function renderTree(
  nodes: ManifestNode[],
  currentHtmlPath: string,
  depth = 0,
): string {
  if (!nodes.length) return "";
  return `<ul class="site-tree" data-depth="${depth}">${nodes
    .map((node) => {
      if (node.kind === "directory") {
        const kids = renderTree(node.children ?? [], currentHtmlPath, depth + 1);
        return `<li class="site-tree-dir"><button type="button" class="site-tree-toggle" aria-expanded="true">${escapeHtml(node.name)}</button>${kids}</li>`;
      }
      const href = node.href ?? "#";
      const active = node.href === currentHtmlPath ? " is-active" : "";
      // href in manifest is site-relative from out root (notes/…)
      const rel = relativeHref(currentHtmlPath, href);
      return `<li class="site-tree-file${active}"><a href="${escapeHtml(rel)}">${escapeHtml(node.name)}</a></li>`;
    })
    .join("")}</ul>`;
}

export function renderNotePage(options: {
  config: SiteConfig;
  page: BuiltPage;
  manifest: ManifestNode[];
  themes: string[];
}): string {
  const { config, page, manifest, themes } = options;
  const cssHref = relativeHref(page.htmlPath, "assets/site.css");
  const jsHref = relativeHref(page.htmlPath, "assets/site.js");
  const themeOptions = themes
    .map(
      (id) =>
        `<option value="${escapeHtml(id)}"${id === config.defaultTheme ? " selected" : ""}>${escapeHtml(id)}</option>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="${escapeHtml(config.defaultTheme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)} · ${escapeHtml(config.siteName)}</title>
  ${config.siteDescription ? `<meta name="description" content="${escapeHtml(config.siteDescription)}">` : ""}
  <link rel="stylesheet" href="${escapeHtml(cssHref)}">
</head>
<body class="site-body">
  <header class="site-header">
    <a class="site-brand" href="${escapeHtml(relativeHref(page.htmlPath, "index.html"))}">${escapeHtml(config.siteName)}</a>
    <label class="site-theme-picker">
      <span class="site-theme-label">Theme</span>
      <select id="site-theme" aria-label="Theme">${themeOptions}</select>
    </label>
  </header>
  <div class="site-layout">
    <aside class="site-sidebar" aria-label="Notes">
      <nav class="site-nav">${renderTree(manifest, page.htmlPath)}</nav>
    </aside>
    <main class="site-main">
      <article class="ProseMirror site-article">${page.bodyHtml}</article>
    </main>
    <aside class="site-outline" aria-label="Outline">
      <div class="site-outline-title">Outline</div>
      ${renderOutline(page.outline)}
    </aside>
  </div>
  <script src="${escapeHtml(jsHref)}" defer></script>
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
