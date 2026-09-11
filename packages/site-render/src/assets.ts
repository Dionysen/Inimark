/** Shell CSS for the published site (layout + chrome). Editor prose CSS is appended separately. */

import { SITE_GRAPH_JS } from "./site-graph-runtime.ts";

const SCROLLBAR_THIN = `scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #888) transparent;`;

function webkitScrollbar(selector: string): string {
  return `${selector}::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
${selector}::-webkit-scrollbar-track {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
${selector}::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #888);
  border-radius: var(--radius-scrollbar, 4px);
  border: 2px solid transparent;
  background-clip: padding-box;
}
${selector}::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #aaa);
  border: 2px solid transparent;
  background-clip: padding-box;
}
${selector}::-webkit-scrollbar-corner {
  background: transparent;
}`;
}

export const SITE_LAYOUT_CSS = `/* Inimark published site layout */
*, *::before, *::after { box-sizing: border-box; }
html {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui, system-ui, sans-serif);
  overflow-y: auto;
  ${SCROLLBAR_THIN}
}
body {
  margin: 0;
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui, system-ui, sans-serif);
}
/* Keep native / hover scrollbars in sync with the active theme.
   Without this, macOS WebKit can flash a light legacy scrollbar when
   the pointer sits on the bar (overlay -> always-visible switch). */
html { color-scheme: dark; }
html[data-theme="light"],
html[data-theme="grey"] { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }

${webkitScrollbar("html")}
${webkitScrollbar(".site-nav")}

.site-body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
/* Centered three-column cluster; sidebars are fixed on wide screens. */
.site-layout {
  --site-gutter: 20px;
  --site-sidebar-w: 325px;
  --site-rail-w: 312px;
  --site-main-max: 48rem;
  --site-main-w: min(var(--site-main-max), calc(100vw - var(--site-sidebar-w) - var(--site-rail-w) - 2 * var(--site-gutter)));
  --site-cluster-w: calc(var(--site-sidebar-w) + var(--site-main-w) + var(--site-rail-w));
  --site-cluster-left: max(var(--site-gutter), calc((100vw - var(--site-cluster-w)) / 2));
  --site-cluster-right: max(var(--site-gutter), calc((100vw - var(--site-cluster-w)) / 2));
  --site-sidebar-gap: 32px;
  --site-rail-inset: 32px;
  flex: 1;
  display: grid;
  grid-template-columns: var(--site-sidebar-w) minmax(0, var(--site-main-w)) var(--site-rail-w);
  justify-content: center;
  align-items: start;
  column-gap: 0;
  row-gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 14px var(--site-gutter) 48px;
  background: var(--bg-primary);
}
.site-sidebar,
.site-rail,
.site-graph,
.site-outline {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  min-height: 0;
}
.site-sidebar {
  display: flex;
  flex-direction: column;
  padding: 0 var(--site-sidebar-gap) 0 0;
  margin-right: var(--site-sidebar-gap);
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.site-sidebar-head {
  flex-shrink: 0;
  padding: 16px 4px 14px;
  border-bottom: none;
}
.site-brand {
  display: block;
  color: var(--text-strong, var(--text-primary));
  text-decoration: none;
  font-weight: 700;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: -0.01em;
  padding: 2px 10px 10px;
}
.site-brand:hover { color: var(--accent); }
.site-lang {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 10px 12px;
}
.site-lang-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
  background: transparent;
}
.site-lang-btn:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.site-lang-btn.is-active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: rgba(var(--accent-rgb, 116, 167, 254), 0.12);
}
.site-theme-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.site-theme-picker select {
  width: 100%;
  background: var(--bg-input, var(--bg-primary));
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
}
.site-nav {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 4px 16px;
  min-height: 0;
  ${SCROLLBAR_THIN}
}
.site-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  padding: 14px 0 16px var(--site-rail-inset);
  margin-left: 16px;
  border: none;
}
.site-graph {
  flex: 0 0 auto;
}
.site-graph-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.site-graph-head .site-rail-title {
  margin-bottom: 0;
}
.site-graph-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.site-graph-btn {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.site-graph-btn:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: var(--bg-hover);
}
.site-graph-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.site-graph-host {
  position: relative;
  width: 100%;
  height: 280px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: transparent;
}

/* Match desktop graph color tokens (tokens.css) for published themes. */
html {
  --inimark-accent: var(--accent);
  --inimark-graph-node: #b4b4b4;
  --inimark-graph-node-active: #d0d0d0;
  --inimark-graph-label: #dcdcdc;
  --inimark-graph-link: #3c3c3c;
  --inimark-graph-highlight: color-mix(in srgb, var(--accent) 62%, #6b7280 38%);
}
html[data-theme="light"],
html[data-theme="grey"] {
  --inimark-graph-node: #6e6e6e;
  --inimark-graph-node-active: #4a4a4a;
  --inimark-graph-label: #333333;
  --inimark-graph-link: #c4c4c4;
  --inimark-graph-highlight: color-mix(in srgb, var(--accent) 55%, #64748b 45%);
}
.site-graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
  touch-action: none;
}
.site-graph-host[data-graph-preview] .site-graph-canvas,
.site-graph-host[data-graph-preview] .site-graph-canvas:active {
  cursor: default;
}
.site-graph-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--bg-primary) 55%, transparent);
  backdrop-filter: blur(6px);
}
.site-graph-modal-dialog {
  width: min(1100px, 100%);
  height: min(780px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}
.site-graph-modal-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
.site-graph-modal-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-strong, var(--text-primary));
}
.site-graph-modal-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.site-graph-modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.site-graph-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px;
}
.site-graph-modal-host {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
html.site-graph-modal-open,
html.site-graph-modal-open body {
  overflow: hidden;
}
.site-outline {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.site-outline::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
.site-main {
  overflow: visible;
  padding: 8px 16px 64px;
  min-width: 0;
  align-self: start;
}
.site-article {
  max-width: none;
  width: 100%;
  margin: 0;
}
.site-article :is(h1, h2, h3, h4, h5, h6) {
  scroll-margin-top: 12px;
}
.site-links-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.site-links-footer-title {
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 650;
  color: var(--text-strong, var(--text-primary));
  letter-spacing: -0.01em;
}
.site-links-footer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 28px;
}
@media (max-width: 640px) {
  .site-links-footer-grid {
    grid-template-columns: 1fr;
  }
}
.site-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-tree .site-tree {
  padding-left: 14px;
  margin-top: 4px;
}
.site-tree-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.site-tree-toggle:hover { background: var(--bg-hover); }
.site-tree-chevron {
  display: inline-grid;
  place-items: center;
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  color: var(--text-tertiary, var(--text-secondary));
  opacity: 0.85;
  transition: transform 0.15s ease;
}
.site-tree-chevron.is-expanded {
  transform: rotate(90deg);
}
.site-tree-chevron svg {
  width: 0.75rem;
  height: 0.75rem;
  display: block;
}
.site-tree-chevron-spacer {
  width: 0.875rem;
  flex-shrink: 0;
}
.site-tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-tree-dir.is-collapsed > .site-tree { display: none; }
.site-tree-file a {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: 8px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13.5px;
  line-height: 1.45;
}
.site-tree-file a:hover { background: var(--bg-hover); }
.site-tree-file.is-active a {
  background: rgba(var(--accent-rgb, 116, 167, 254), 0.15);
  color: var(--accent);
}
.site-rail-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  padding: 0 10px;
}
.site-links-footer .site-links-group + .site-links-group {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
.site-links-subtitle {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  padding: 0;
}
.site-links-count {
  font-weight: 500;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.site-links-list,
.site-outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-links-item a,
.site-outline-item a {
  display: block;
  padding: 6px 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13.5px;
  line-height: 1.45;
  border-radius: 8px;
}
.site-links-footer .site-links-item a {
  padding-left: 0;
  padding-right: 0;
}
.site-links-item a:hover,
.site-outline-item a:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.site-links-footer .site-links-item a:hover {
  background: transparent;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.site-outline-item.level-1 a { font-weight: 600; color: var(--text-primary); }
.site-outline-item.level-3 { padding-left: 10px; }
.site-outline-item.level-4 { padding-left: 20px; }
.site-outline-item.level-5 { padding-left: 30px; }
.site-outline-item.level-6 { padding-left: 40px; }
.site-rail-empty {
  margin: 0;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text-tertiary);
}
a.wiki-link-widget {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid rgba(var(--accent-rgb, 116, 167, 254), 0.35);
}
a.wiki-link-widget:hover { border-bottom-color: var(--accent); }
.wiki-link-widget.is-unresolved {
  color: var(--text-tertiary);
  border-bottom-style: dashed;
}
.site-article yaml-block { display: none !important; }

/* Desktop: fixed sidebars; document scroll carries the article (scrollbar at viewport right). */
@media (min-width: 721px) {
  .site-layout {
    display: grid;
    grid-template-columns: var(--site-sidebar-w) minmax(0, var(--site-main-w)) var(--site-rail-w);
    justify-content: center;
    align-items: start;
    padding: 14px var(--site-gutter) 48px;
  }
  .site-sidebar {
    position: fixed;
    top: 0;
    left: var(--site-cluster-left);
    width: var(--site-sidebar-w);
    height: 100vh;
    max-height: 100vh;
    z-index: 2;
    background: var(--bg-primary);
  }
  .site-rail {
    position: fixed;
    top: 0;
    right: var(--site-cluster-right);
    width: var(--site-rail-w);
    height: 100vh;
    max-height: 100vh;
    margin-left: 0;
    z-index: 2;
    background: var(--bg-primary);
  }
  .site-main {
    grid-column: 2;
    position: relative;
    z-index: 1;
    overflow: visible;
    margin-left: var(--site-sidebar-gap);
    padding: 8px 16px 64px;
  }
  .site-article {
    max-width: none;
    width: 100%;
    margin: 0;
  }
}

@media (max-width: 1100px) {
  .site-layout {
    --site-sidebar-w: 299px;
    --site-rail-w: 273px;
    --site-main-max: 44rem;
    --site-main-w: min(var(--site-main-max), calc(100vw - var(--site-sidebar-w) - var(--site-rail-w) - 2 * var(--site-gutter)));
    --site-gutter: 14px;
  }
}
@media (max-width: 960px) {
  .site-layout {
    --site-rail-w: 0px;
    --site-main-w: min(var(--site-main-max), calc(100vw - var(--site-sidebar-w) - 2 * var(--site-gutter)));
  }
  .site-rail { display: none; }
}
@media (max-width: 720px) {
  html,
  body {
    height: auto;
    overflow: visible;
  }
  html {
    overflow-y: auto;
  }
  .site-body {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .site-layout {
    display: grid;
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
    padding: 10px;
    gap: 10px;
  }
  .site-sidebar {
    position: static;
    width: auto;
    height: auto;
    max-height: 45vh;
    margin-right: 0;
    padding-right: 0;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    overflow: hidden;
  }
  .site-nav {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .site-rail {
    position: static;
    width: auto;
    height: auto;
    max-height: none;
    overflow: hidden;
  }
  .site-outline {
    max-height: 40vh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .site-main {
    position: static;
    overflow: visible;
    margin-left: 0;
    padding: 12px 8px 48px;
  }
  .site-article {
    max-width: none;
    margin: 0;
  }
}
`;

export const SITE_JS = `(() => {
  const STORAGE_KEY = "inimark-site-theme";
  const root = document.documentElement;
  const select = document.getElementById("site-theme");
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    root.setAttribute("data-theme", saved);
    if (select) select.value = saved;
  }
  select?.addEventListener("change", () => {
    const value = select.value;
    root.setAttribute("data-theme", value);
    localStorage.setItem(STORAGE_KEY, value);
  });
  document.querySelectorAll(".site-tree-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const li = btn.closest(".site-tree-dir");
      if (!li) return;
      const open = btn.getAttribute("aria-expanded") !== "false";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      li.classList.toggle("is-collapsed", open);
      btn.querySelector(".site-tree-chevron")?.classList.toggle("is-expanded", !open);
      const nested = li.querySelector(":scope > .site-tree");
      if (nested) nested.hidden = open;
    });
  });

  const LANG_KEY = "inimark-site-lang";
  document.querySelectorAll(".site-lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      if (lang) localStorage.setItem(LANG_KEY, lang);
    });
  });

  const main = document.querySelector(".site-main");
  if (main) {
    const scrollRoot = document.scrollingElement || document.documentElement;
    const scrollToHash = (hash) => {
      if (!hash || hash === "#") return;
      const id = decodeURIComponent(hash.slice(1));
      const target = document.getElementById(id);
      if (!target) return;
      const top =
        target.getBoundingClientRect().top +
        scrollRoot.scrollTop -
        12;
      scrollRoot.scrollTo({ top, behavior: "smooth" });
    };
    main.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      event.preventDefault();
      scrollToHash(href);
      history.replaceState(null, "", href);
    });
    if (location.hash) scrollToHash(location.hash);
  }
${SITE_GRAPH_JS}
})();
`;
