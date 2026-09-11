/** Shell CSS for the published site (layout + chrome). Editor prose CSS is appended separately. */

import { SITE_GRAPH_JS } from "./site-graph-runtime.ts";

export const SITE_LAYOUT_CSS = `/* Inimark published site layout */
*, *::before, *::after { box-sizing: border-box; }
html {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui, system-ui, sans-serif);
  /* Document scrollbar lives on the far right of the viewport. */
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #888) transparent;
}
body {
  margin: 0;
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui, system-ui, sans-serif);
}
/* Keep native / hover scrollbars in sync with the active theme.
   Without this, macOS WebKit can flash a light 鈥渓egacy鈥?scrollbar when
   the pointer sits on the bar (overlay 鈫?always-visible switch). */
html { color-scheme: dark; }
html[data-theme="light"],
html[data-theme="grey"] { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }

html::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
html::-webkit-scrollbar-track {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
html::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #888);
  border-radius: var(--radius-scrollbar, 4px);
  border: 2px solid transparent;
  background-clip: padding-box;
}
html::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #aaa);
  border: 2px solid transparent;
  background-clip: padding-box;
}
html::-webkit-scrollbar-corner {
  background: transparent;
}

/* Left nav may still scroll independently when sticky; keep a thin bar. */
.site-nav {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #888) transparent;
}
.site-nav::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.site-nav::-webkit-scrollbar-track {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.site-nav::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #888);
  border-radius: var(--radius-scrollbar, 4px);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.site-nav::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #aaa);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.site-nav::-webkit-scrollbar-corner {
  background: transparent;
}

/* Right rail: allow overflow for long outlines, but never show a scrollbar. */
.site-rail,
.site-outline {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.site-rail::-webkit-scrollbar,
.site-outline::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.site-body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
/* Cluster sidebars against the article: fixed column widths + centered grid.
   Page height follows the article; window scrollbar is the site scrollbar. */
.site-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 325px minmax(0, 44rem) 312px;
  justify-content: center;
  align-items: start;
  column-gap: 0;
  row-gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 14px 20px 48px;
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
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 32px 0 0;
  margin-right: 32px;
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
  overflow: auto;
  padding: 10px 4px 16px;
  min-height: 0;
}
.site-rail {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px 0 16px 32px;
  margin-left: 16px;
  border: none;
}
.site-graph {
  flex: 0 0 auto;
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
  cursor: grab;
  touch-action: none;
}
.site-graph-canvas:active {
  cursor: grabbing;
}
.site-outline {
  overflow: visible;
  padding: 0;
  flex: 0 0 auto;
  min-height: 0;
}
.site-main {
  overflow: visible;
  padding: 8px 16px 64px;
  min-width: 0;
}
.site-article {
  max-width: none;
  width: 100%;
  margin: 0;
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
@media (max-width: 1100px) {
  .site-layout {
    grid-template-columns: 299px minmax(0, 40rem) 273px;
    padding: 12px 14px;
  }
}
@media (max-width: 960px) {
  .site-layout {
    grid-template-columns: minmax(260px, 312px) minmax(0, 44rem);
    justify-content: center;
  }
  .site-rail { display: none; }
}
@media (max-width: 720px) {
  .site-layout {
    grid-template-columns: 1fr;
    padding: 10px;
    gap: 10px;
  }
  .site-sidebar {
    position: static;
    height: auto;
    max-height: 45vh;
    margin-right: 0;
    padding-right: 0;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }
  .site-rail {
    position: static;
    height: auto;
  }
  .site-main { padding: 12px 8px 48px; }
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
${SITE_GRAPH_JS}
})();
`;
