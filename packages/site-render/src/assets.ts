/** Shell CSS for the published site (layout + chrome). Editor prose CSS is appended separately. */

export const SITE_LAYOUT_CSS = `/* Inimark published site layout */
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui, system-ui, sans-serif);
}
/* Keep native / hover scrollbars in sync with the active theme.
   Without this, macOS WebKit can flash a light “legacy” scrollbar when
   the pointer sits on the bar (overlay → always-visible switch). */
html { color-scheme: dark; }
html[data-theme="light"],
html[data-theme="grey"] { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }

.site-nav,
.site-outline,
.site-main {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, #888) transparent;
}
.site-nav::-webkit-scrollbar,
.site-outline::-webkit-scrollbar,
.site-main::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.site-nav::-webkit-scrollbar-track,
.site-outline::-webkit-scrollbar-track,
.site-main::-webkit-scrollbar-track {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.site-nav::-webkit-scrollbar-thumb,
.site-outline::-webkit-scrollbar-thumb,
.site-main::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #888);
  border-radius: var(--radius-scrollbar, 4px);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.site-nav::-webkit-scrollbar-thumb:hover,
.site-outline::-webkit-scrollbar-thumb:hover,
.site-main::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #aaa);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.site-nav::-webkit-scrollbar-corner,
.site-outline::-webkit-scrollbar-corner,
.site-main::-webkit-scrollbar-corner {
  background: transparent;
}

.site-body {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.site-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) minmax(180px, 260px);
  gap: 14px;
  min-height: 0;
  height: 100%;
  padding: 14px;
  background: var(--bg-primary);
}
.site-sidebar, .site-outline {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.14);
  min-height: 0;
}
.site-sidebar {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
.site-sidebar-head {
  flex-shrink: 0;
  padding: 16px 14px 14px;
  border-bottom: 1px solid var(--border);
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
  padding: 10px 14px 16px;
  min-height: 0;
}
.site-outline {
  overflow: auto;
  padding: 16px 14px;
}
.site-main {
  overflow: auto;
  padding: 20px 28px 64px;
  min-width: 0;
}
.site-article {
  max-width: 720px;
  margin: 0 auto;
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
.site-outline-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  padding: 0 10px;
}
.site-outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-outline-item a {
  display: block;
  padding: 6px 10px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13.5px;
  line-height: 1.45;
  border-radius: 8px;
}
.site-outline-item a:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.site-outline-item.level-1 a { font-weight: 600; color: var(--text-primary); }
.site-outline-item.level-3 { padding-left: 10px; }
.site-outline-item.level-4 { padding-left: 20px; }
.site-outline-item.level-5 { padding-left: 30px; }
.site-outline-item.level-6 { padding-left: 40px; }
.site-outline-empty {
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
@media (max-width: 960px) {
  .site-layout {
    grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  }
  .site-outline { display: none; }
}
@media (max-width: 720px) {
  .site-layout {
    grid-template-columns: 1fr;
    padding: 10px;
    gap: 10px;
    height: auto;
    min-height: 100%;
  }
  .site-sidebar {
    max-height: 45vh;
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
})();
`;
