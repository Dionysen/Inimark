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
.site-body { min-height: 100%; display: flex; flex-direction: column; }
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.site-brand {
  color: var(--text-strong, var(--text-primary));
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
}
.site-brand:hover { color: var(--accent); }
.site-theme-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.site-theme-picker select {
  background: var(--bg-input, var(--bg-primary));
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 4px);
  height: 28px;
  padding: 0 8px;
}
.site-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr) minmax(140px, 220px);
  min-height: 0;
}
.site-sidebar, .site-outline {
  overflow: auto;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: 12px 10px;
}
.site-outline {
  border-right: none;
  border-left: 1px solid var(--border);
}
.site-main {
  overflow: auto;
  padding: 28px 36px 64px;
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
  padding-left: 12px;
  margin-top: 2px;
}
.site-tree-toggle {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 6px;
  border-radius: var(--radius-control, 4px);
  cursor: pointer;
}
.site-tree-toggle:hover { background: var(--bg-hover); }
.site-tree-file a {
  display: block;
  padding: 4px 6px;
  border-radius: var(--radius-control, 4px);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
}
.site-tree-file a:hover { background: var(--bg-hover); }
.site-tree-file.is-active a {
  background: rgba(var(--accent-rgb, 116, 167, 254), 0.15);
  color: var(--accent);
}
.site-outline-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}
.site-outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-outline-item a {
  display: block;
  padding: 3px 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  border-radius: var(--radius-control, 4px);
}
.site-outline-item a:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.site-outline-item.level-1 a { font-weight: 600; color: var(--text-primary); }
.site-outline-item.level-3 { padding-left: 8px; }
.site-outline-item.level-4 { padding-left: 16px; }
.site-outline-item.level-5 { padding-left: 24px; }
.site-outline-item.level-6 { padding-left: 32px; }
.site-outline-empty {
  margin: 0;
  font-size: 12px;
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
@media (max-width: 960px) {
  .site-layout { grid-template-columns: minmax(160px, 200px) minmax(0, 1fr); }
  .site-outline { display: none; }
}
@media (max-width: 720px) {
  .site-layout { grid-template-columns: 1fr; }
  .site-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 40vh;
  }
  .site-main { padding: 20px 16px 48px; }
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
      const nested = li.querySelector(":scope > .site-tree");
      if (nested) nested.hidden = open;
    });
  });
})();
`;
