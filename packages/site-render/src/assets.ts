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
html[data-theme="grey"],
html[data-theme="slate"],
html[data-theme="claude-code"],
html[data-theme="mint"],
html[data-theme="purple"],
html[data-theme="hermes"] { color-scheme: light; }
html[data-theme="ocean"],
html[data-theme="dark-modern"],
html[data-theme="cursor"],
html[data-theme="dracula"] { color-scheme: dark; }

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
  --site-sidebar-w: 260px;
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
  padding: 0 10px 0 0;
  margin-right: var(--site-sidebar-gap);
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.site-sidebar-head {
  flex-shrink: 0;
  padding: 16px 4px 14px;
  border-bottom: none;
}
.site-sidebar-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-right: 6px;
}
.site-brand {
  display: block;
  flex: 1;
  min-width: 0;
  color: var(--text-strong, var(--text-primary));
  text-decoration: none;
  font-weight: 700;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: -0.01em;
  padding: 2px 10px 10px;
}
.site-brand:hover { color: var(--accent); }
.site-theme-toggle {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-top: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.site-theme-toggle:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--bg-hover, transparent);
}
.site-theme-toggle .site-theme-icon {
  display: none;
}
html[data-appearance="dark"] .site-theme-toggle .site-theme-icon-sun,
html:not([data-appearance="dark"]) .site-theme-toggle .site-theme-icon-moon {
  display: block;
}
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
.site-nav {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 4px 16px;
  min-height: 0;
  visibility: hidden;
  ${SCROLLBAR_THIN}
}
html[data-tree-ready] .site-nav {
  visibility: visible;
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
.site-article .code-block-node.has-diagram .diagram-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin: 8px 0 16px;
  overflow-x: auto;
  text-align: center;
}
.site-article .code-block-node.has-diagram .diagram-panel > svg,
.site-article .code-block-node.has-diagram .diagram-panel .mermaid > svg {
  display: block;
  margin-inline: auto;
  width: auto;
  max-width: 100%;
  height: auto;
}
.site-article .code-block-node.has-diagram .diagram-panel pre.mermaid {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
  width: auto;
  max-width: 100%;
  font: inherit;
  color: inherit;
  white-space: pre-wrap;
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
    --site-sidebar-w: 240px;
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

/** Runs in `<head>` before CSS so navigation does not flash the default theme. */
export const SITE_THEME_BOOT_JS = `(() => {
  try {
    const root = document.documentElement;
    const light = root.getAttribute("data-theme-light") || "light";
    const dark = root.getAttribute("data-theme-dark") || "ocean";
    const saved = localStorage.getItem("inimark-site-theme");
    let mode = root.getAttribute("data-appearance") === "dark" ? "dark" : "light";
    if (saved === "dark" || saved === dark) mode = "dark";
    else if (saved === "light" || saved === light) mode = "light";
    else if (saved && /dark/i.test(saved)) mode = "dark";
    else if (saved) mode = "light";
    root.setAttribute("data-theme", mode === "dark" ? dark : light);
    root.dataset.appearance = mode;
  } catch (_) {}
})();`;

/** Runs immediately after the sidebar tree so expand state is restored before paint. */
export const SITE_TREE_BOOT_JS = `(() => {
  const TREE_KEY = "inimark-site-tree";
  const root = document.documentElement;
  const loadTreeState = () => {
    try {
      const raw = localStorage.getItem(TREE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  };
  const saveTreeState = (state) => {
    try {
      localStorage.setItem(TREE_KEY, JSON.stringify(state));
    } catch (_) {}
  };
  const setDirOpen = (li, open) => {
    const btn = li.querySelector(":scope > .site-tree-toggle");
    if (!btn) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    li.classList.toggle("is-collapsed", !open);
    btn.querySelector(".site-tree-chevron")?.classList.toggle("is-expanded", open);
    const nested = li.querySelector(":scope > .site-tree");
    if (nested) nested.hidden = !open;
  };
  try {
    const state = loadTreeState();
    let changed = false;
    document.querySelectorAll(".site-tree-dir").forEach((li) => {
      const path = li.getAttribute("data-tree-path");
      const containsActive = Boolean(li.querySelector(".site-tree-file.is-active"));
      let open = containsActive;
      if (!containsActive && path && Object.prototype.hasOwnProperty.call(state, path)) {
        open = Boolean(state[path]);
      } else if (!containsActive) {
        const btn = li.querySelector(":scope > .site-tree-toggle");
        open = btn?.getAttribute("aria-expanded") !== "false";
      }
      setDirOpen(li, open);
      if (path && state[path] !== open) {
        state[path] = open;
        changed = true;
      }
    });
    if (changed) saveTreeState(state);
  } catch (_) {}
  root.setAttribute("data-tree-ready", "1");
})();`;

export const SITE_JS = `(() => {
  const STORAGE_KEY = "inimark-site-theme";
  const root = document.documentElement;
  const toggle = document.getElementById("site-theme-toggle");
  const lightTheme = root.getAttribute("data-theme-light") || "light";
  const darkTheme = root.getAttribute("data-theme-dark") || "ocean";

  const currentMode = () =>
    root.dataset.appearance === "dark" || root.getAttribute("data-theme") === darkTheme
      ? "dark"
      : "light";

  const applyAppearance = (mode) => {
    const next = mode === "dark" ? "dark" : "light";
    root.dataset.appearance = next;
    root.setAttribute("data-theme", next === "dark" ? darkTheme : lightTheme);
    localStorage.setItem(STORAGE_KEY, next);
  };

  // Re-apply after DOM ready in case boot script and default attrs raced.
  {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === darkTheme) applyAppearance("dark");
    else if (saved === "light" || saved === lightTheme) applyAppearance("light");
    else if (saved && /dark/i.test(saved)) applyAppearance("dark");
    else applyAppearance(currentMode());
  }

  const LIGHT_FALLBACKS = {
    surface: "#ffffff",
    secondary: "#f6f8fa",
    tertiary: "#eaeef2",
    contentBg: "#ffffff",
    code: "#f6f8fa",
    fg: "#1f2328",
    muted: "#656d76",
    border: "#d0d7de",
    accent: "#0969da",
    accentHover: "#0550ae",
    danger: "#cf222e",
    blockquoteBg: "#f6f8fa",
    blockquoteBorder: "#d0d7de",
  };
  const DARK_FALLBACKS = {
    surface: "#1b1d24",
    secondary: "#111217",
    tertiary: "#25272b",
    contentBg: "#1b1d24",
    code: "#1f2129",
    fg: "#ece7dd",
    muted: "#aeb6c2",
    border: "#4a4d52",
    accent: "#8ab4e7",
    accentHover: "#b994f4",
    danger: "#ff8f86",
    blockquoteBg: "#2d2a22",
    blockquoteBorder: "#8a7440",
  };

  const clampByte = (n) => Math.min(255, Math.max(0, Math.round(n)));
  const toHex = ({ r, g, b }) =>
    "#" +
    [r, g, b]
      .map((n) => clampByte(n).toString(16).padStart(2, "0"))
      .join("");

  const parseCssColor = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed || trimmed === "transparent") return null;
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
      let hex = trimmed.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
    const rgb = trimmed.match(
      /^rgba?\\(\\s*([\\d.]+)\\s*[,\\s]\\s*([\\d.]+)\\s*[,\\s]\\s*([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)$/i,
    );
    if (rgb) {
      let a = 1;
      if (rgb[4] != null) {
        a = rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : Number(rgb[4]);
      }
      return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
        a: Math.min(1, Math.max(0, a)),
      };
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (r + g + b + a > 0 || /^black$/i.test(trimmed) || trimmed === "#000" || trimmed === "#000000") {
          return { r, g, b, a: a / 255 };
        }
      }
    } catch (_) {}
    return null;
  };

  const toMermaidColor = (value, fallback, backdrop = "#ffffff") => {
    const parsed = parseCssColor(value) || parseCssColor(fallback);
    const fb = parseCssColor(fallback) || { r: 128, g: 128, b: 128, a: 1 };
    const color = parsed || fb;
    if (color.a >= 0.999) return toHex(color);
    const base = parseCssColor(backdrop) || { r: 255, g: 255, b: 255, a: 1 };
    const a = color.a;
    return toHex({
      r: color.r * a + base.r * (1 - a),
      g: color.g * a + base.g * (1 - a),
      b: color.b * a + base.b * (1 - a),
    });
  };

  const readCssVar = (name, fallback) => {
    try {
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      return value || fallback;
    } catch (_) {
      return fallback;
    }
  };

  const isDarkAppearance = () => {
    if (root.dataset.appearance === "dark") return true;
    if (root.dataset.appearance === "light") return false;
    const theme = root.getAttribute("data-theme") || "";
    if (/dark/i.test(theme)) return true;
    if (/light|grey|gray/i.test(theme)) return false;
    const bg = parseCssColor(readCssVar("--bg-primary", "#ffffff"));
    if (!bg) return false;
    return (0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b) / 255 < 0.45;
  };

  const syncAppearance = () => {
    if (root.dataset.appearance === "dark" || root.dataset.appearance === "light") return;
    root.dataset.appearance = isDarkAppearance() ? "dark" : "light";
  };

  const resolveArticleFontSize = () => {
    const el =
      document.querySelector(".site-article .ProseMirror") ||
      document.querySelector(".site-article") ||
      document.body;
    try {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(px) && px > 0) return px;
    } catch (_) {}
    const fromVar = parseFloat(readCssVar("--editor-font-size", readCssVar("--inimark-editor-font-size", "16")));
    return Number.isFinite(fromVar) && fromVar > 0 ? fromVar : 16;
  };

  const resolveMermaidFontSize = () => Math.max(10, Math.round(resolveArticleFontSize()) - 2);

  const resolveDiagramContainerWidth = () => {
    const panel = document.querySelector(".site-article .diagram-panel");
    if (panel && panel.clientWidth > 0) return panel.clientWidth;
    const article = document.querySelector(".site-article");
    if (article && article.clientWidth > 0) return Math.max(280, article.clientWidth);
    return 640;
  };

  const buildMermaidThemeVariables = () => {
    const dark = isDarkAppearance();
    const fb = dark ? DARK_FALLBACKS : LIGHT_FALLBACKS;
    const contentBgRaw = readCssVar("--bg-primary", readCssVar("--inimark-content-bg", fb.contentBg));
    const contentBg = toMermaidColor(contentBgRaw, fb.contentBg, fb.contentBg);
    const solid = (raw, fallback) => toMermaidColor(raw, fallback, contentBg);
    const s = {
      surface: solid(readCssVar("--bg-surface", readCssVar("--inimark-surface", fb.surface)), fb.surface),
      secondary: solid(readCssVar("--bg-secondary", readCssVar("--inimark-bg", fb.secondary)), fb.secondary),
      tertiary: solid(
        readCssVar("--bg-tertiary", readCssVar("--inimark-surface-raised", fb.tertiary)),
        fb.tertiary,
      ),
      contentBg,
      code: solid(readCssVar("--bg-code", fb.code), fb.code),
      fg: solid(readCssVar("--text-primary", readCssVar("--inimark-fg", fb.fg)), fb.fg),
      muted: solid(readCssVar("--text-secondary", readCssVar("--inimark-muted-fg", fb.muted)), fb.muted),
      border: solid(readCssVar("--border", readCssVar("--inimark-border", fb.border)), fb.border),
      accent: solid(readCssVar("--accent", readCssVar("--inimark-accent", fb.accent)), fb.accent),
      accentHover: solid(readCssVar("--accent-hover", fb.accentHover), fb.accentHover),
      danger: solid(readCssVar("--danger", fb.danger), fb.danger),
      blockquoteBg: solid(readCssVar("--blockquote-bg", fb.blockquoteBg), fb.blockquoteBg),
      blockquoteBorder: solid(readCssVar("--blockquote-border", fb.blockquoteBorder), fb.blockquoteBorder),
    };
    const pieSectionText = dark ? s.contentBg : s.fg;
    const fontSize = resolveMermaidFontSize() + "px";
    return {
      darkMode: dark,
      background: "transparent",
      fontSize,
      primaryColor: s.surface,
      secondaryColor: s.secondary,
      tertiaryColor: s.tertiary,
      mainBkg: s.surface,
      secondBkg: s.secondary,
      primaryTextColor: s.fg,
      secondaryTextColor: s.fg,
      tertiaryTextColor: s.fg,
      textColor: s.fg,
      nodeTextColor: s.fg,
      primaryBorderColor: s.border,
      secondaryBorderColor: s.border,
      tertiaryBorderColor: s.border,
      lineColor: s.muted,
      arrowheadColor: s.muted,
      defaultLinkColor: s.muted,
      titleColor: s.accent,
      edgeLabelBackground: s.code,
      clusterBkg: s.secondary,
      clusterBorder: s.border,
      noteBkgColor: s.blockquoteBg,
      noteTextColor: s.fg,
      noteBorderColor: s.blockquoteBorder,
      actorBkg: s.surface,
      actorTextColor: s.fg,
      actorBorder: s.border,
      actorLineColor: s.border,
      labelBoxBkgColor: s.surface,
      labelBoxBorderColor: s.border,
      signalColor: s.muted,
      signalTextColor: s.fg,
      labelTextColor: s.fg,
      loopTextColor: s.fg,
      activationBorderColor: s.border,
      activationBkgColor: s.tertiary,
      sequenceNumberColor: s.contentBg,
      sectionBkgColor: s.surface,
      altSectionBkgColor: s.tertiary,
      sectionBkgColor2: s.surface,
      excludeBkgColor: s.danger,
      taskBorderColor: s.border,
      taskBkgColor: s.surface,
      taskTextColor: s.fg,
      taskTextOutsideColor: s.fg,
      taskTextLightColor: s.contentBg,
      taskTextDarkColor: s.fg,
      taskTextClickableColor: s.accent,
      activeTaskBorderColor: s.accent,
      activeTaskBkgColor: s.secondary,
      doneTaskBkgColor: s.code,
      doneTaskBorderColor: s.border,
      critBorderColor: s.danger,
      critBkgColor: s.secondary,
      gridColor: s.border,
      todayLineColor: s.danger,
      vertLineColor: s.border,
      personBkg: s.surface,
      personBorder: s.border,
      rowOdd: s.code,
      rowEven: s.secondary,
      transitionColor: s.muted,
      transitionLabelColor: s.fg,
      stateLabelColor: s.fg,
      stateBkg: s.surface,
      labelBackgroundColor: s.code,
      compositeBackground: s.secondary,
      altBackground: s.tertiary,
      compositeTitleBackground: s.tertiary,
      compositeBorder: s.border,
      innerEndBackground: s.fg,
      errorBkgColor: s.secondary,
      errorTextColor: s.danger,
      specialStateColor: s.accent,
      scaleLabelColor: s.fg,
      classText: s.fg,
      requirementBackground: s.surface,
      requirementBorderColor: s.border,
      requirementTextColor: s.fg,
      relationColor: s.muted,
      relationLabelBackground: s.code,
      relationLabelColor: s.fg,
      branchLabelColor: s.fg,
      tagLabelColor: s.fg,
      tagLabelBackground: s.code,
      tagLabelBorder: s.border,
      commitLabelColor: s.fg,
      commitLabelBackground: s.code,
      archEdgeColor: s.muted,
      archEdgeArrowColor: s.muted,
      archGroupBorderColor: s.border,
      quadrant1TextFill: s.fg,
      quadrant2TextFill: s.fg,
      quadrant3TextFill: s.fg,
      quadrant4TextFill: s.fg,
      quadrantPointTextFill: s.fg,
      quadrantXAxisTextFill: s.fg,
      quadrantYAxisTextFill: s.fg,
      quadrantTitleFill: s.accent,
      pieTitleTextColor: s.accent,
      pieSectionTextColor: pieSectionText,
      pieLegendTextColor: s.fg,
      pieStrokeColor: pieSectionText,
      vennTitleTextColor: s.accent,
      vennSetTextColor: s.fg,
      wardleyEvolutionColor: s.accent,
      xyChart: {
        titleColor: s.accent,
        dataLabelColor: s.fg,
        xAxisTitleColor: s.fg,
        xAxisLabelColor: s.fg,
        xAxisTickColor: s.muted,
        xAxisLineColor: s.muted,
        yAxisTitleColor: s.fg,
        yAxisLabelColor: s.fg,
        yAxisTickColor: s.muted,
        yAxisLineColor: s.muted,
        plotColorPalette: s.accent + "," + s.accentHover + "," + s.muted + "," + s.danger,
      },
      packet: {
        startByteColor: s.fg,
        endByteColor: s.fg,
        labelColor: s.fg,
        titleColor: s.accent,
        blockStrokeColor: s.border,
        blockFillColor: s.surface,
      },
      wardley: {
        axisTextColor: s.fg,
        componentLabelColor: s.fg,
        annotationTextColor: s.fg,
      },
    };
  };

  syncAppearance();

  const waitForMermaid = () =>
    new Promise((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      let tries = 0;
      const timer = setInterval(() => {
        if (window.mermaid) {
          clearInterval(timer);
          resolve(window.mermaid);
        } else if (++tries > 200) {
          clearInterval(timer);
          reject(new Error("Mermaid failed to load"));
        }
      }, 25);
    });

  const markDiagramSuccess = (pre) => {
    const panel = pre.closest(".diagram-panel");
    const block = pre.closest(".code-block-node");
    if (panel) panel.dataset.diagramState = "success";
    if (block) {
      block.classList.add("diagram-success");
      block.classList.remove("diagram-pending");
    }
  };

  const readSvgIntrinsicSize = (svg) => {
    let w = 0;
    let h = 0;
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
    const style = svg.getAttribute("style") || "";
    const maxW = /max-width:\s*([\d.]+)px/i.exec(style);
    if (maxW) w = w || parseFloat(maxW[1]);
    const attrW = parseFloat(svg.getAttribute("width") || "");
    const attrH = parseFloat(svg.getAttribute("height") || "");
    if (Number.isFinite(attrW) && attrW > 0) w = w || attrW;
    if (Number.isFinite(attrH) && attrH > 0) h = h || attrH;
    if (!(w > 0) || !(h > 0)) {
      try {
        const bbox = svg.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          w = w || bbox.width;
          h = h || bbox.height;
        }
      } catch (_) {}
    }
    return { w, h };
  };

  // Keep SVG at Mermaid's intrinsic size so themeVariables.fontSize (body−2px)
  // maps 1:1 to on-screen px. Only shrink when wider than the column.
  const fitMermaidSvg = (svg) => {
    let { w: intrinsicW, h: intrinsicH } = readSvgIntrinsicSize(svg);
    if (!(intrinsicW > 0)) return;
    if (!(intrinsicH > 0)) intrinsicH = intrinsicW;
    if (!svg.getAttribute("viewBox")) {
      svg.setAttribute("viewBox", "0 0 " + intrinsicW + " " + intrinsicH);
    }
    svg.removeAttribute("height");
    svg.setAttribute("width", String(intrinsicW));
    svg.style.width = intrinsicW + "px";
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
  };

  const fitMermaidDiagrams = (roots) => {
    roots.forEach((rootEl) => {
      const svgs = rootEl.tagName === "svg"
        ? [rootEl]
        : Array.from(rootEl.querySelectorAll("svg"));
      svgs.forEach((svg) => fitMermaidSvg(svg));
    });
  };

  const renderMermaidDiagrams = async () => {
    const nodes = Array.from(document.querySelectorAll("pre.mermaid"));
    if (!nodes.length) return;
    try {
      syncAppearance();
      const mermaid = await waitForMermaid();
      const fontPx = resolveMermaidFontSize();
      const containerW = resolveDiagramContainerWidth();
      const chartSize = Math.max(320, Math.min(containerW, 900));
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        themeVariables: buildMermaidThemeVariables(),
        // useMaxWidth:false → absolute px size so fontSize stays 1:1 on screen
        flowchart: { useMaxWidth: false, htmlLabels: true },
        sequence: { useMaxWidth: false },
        gantt: { useMaxWidth: false },
        journey: { useMaxWidth: false },
        class: { useMaxWidth: false },
        state: { useMaxWidth: false },
        er: { useMaxWidth: false },
        pie: { useMaxWidth: false },
        quadrantChart: {
          useMaxWidth: false,
          chartWidth: chartSize,
          chartHeight: chartSize,
          pointLabelFontSize: fontPx,
          quadrantLabelFontSize: fontPx,
          xAxisLabelFontSize: fontPx,
          yAxisLabelFontSize: fontPx,
          titleFontSize: fontPx + 4,
        },
        xyChart: {
          useMaxWidth: false,
          width: chartSize,
          height: Math.round(chartSize * 0.62),
          titleFontSize: fontPx + 2,
        },
      });
      await mermaid.run({ nodes });
      nodes.forEach(markDiagramSuccess);
      fitMermaidDiagrams(nodes);
    } catch (error) {
      console.warn("Inimark site: Mermaid render failed", error);
    }
  };

  toggle?.addEventListener("click", () => {
    applyAppearance(currentMode() === "dark" ? "light" : "dark");
    // Mermaid SVG colors are baked at render time; reload to re-theme diagrams.
    if (document.querySelector("pre.mermaid, .diagram-panel svg")) {
      location.reload();
      return;
    }
  });

  const TREE_KEY = "inimark-site-tree";
  const loadTreeState = () => {
    try {
      const raw = localStorage.getItem(TREE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  };
  const saveTreeState = (state) => {
    try {
      localStorage.setItem(TREE_KEY, JSON.stringify(state));
    } catch (_) {}
  };
  const setDirOpen = (li, open) => {
    const btn = li.querySelector(":scope > .site-tree-toggle");
    if (!btn) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    li.classList.toggle("is-collapsed", !open);
    btn.querySelector(".site-tree-chevron")?.classList.toggle("is-expanded", open);
    const nested = li.querySelector(":scope > .site-tree");
    if (nested) nested.hidden = !open;
  };
  document.querySelectorAll(".site-tree-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const li = btn.closest(".site-tree-dir");
      if (!li) return;
      const open = btn.getAttribute("aria-expanded") !== "false";
      setDirOpen(li, !open);
      const path = li.getAttribute("data-tree-path");
      if (!path) return;
      const state = loadTreeState();
      state[path] = !open;
      saveTreeState(state);
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

  renderMermaidDiagrams();
${SITE_GRAPH_JS}
})();
`;
