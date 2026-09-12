(function () {
  var STORAGE_KEY = "inimark-site-theme";

  var DOCS_THEME_KEY = "site-theme";

  function getPreference() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
      var docs = localStorage.getItem(DOCS_THEME_KEY);
      if (docs === "light" || docs === "dark") {
        localStorage.setItem(STORAGE_KEY, docs);
        return docs;
      }
    } catch (_) {}
    return "system";
  }

  function resolveTheme(pref) {
    if (pref === "dark") return "dark";
    if (pref === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncDocsTheme(resolved) {
    try {
      localStorage.setItem(DOCS_THEME_KEY, resolved);
      localStorage.setItem("theme", resolved);
      localStorage.setItem("color-scheme", resolved);
    } catch (_) {}
    var root = document.documentElement;
    root.classList.toggle("theme-dark", resolved === "dark");
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = resolved;
    var body = document.body;
    if (body) {
      body.classList.toggle("theme-dark", resolved === "dark");
      body.classList.toggle("theme-light", resolved !== "dark");
    }
  }

  function applyTheme() {
    var pref = getPreference();
    var resolved = resolveTheme(pref);
    var root = document.documentElement;
    root.dataset.siteTheme = resolved;
    root.style.colorScheme = resolved;
    syncDocsTheme(resolved);
    document.querySelectorAll("[data-theme-pref]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", pref === "system" ? "mixed" : String(pref === "dark"));
      btn.title = pref === "dark"
        ? (btn.dataset.labelLight || "Light mode")
        : pref === "light"
          ? (btn.dataset.labelDark || "Dark mode")
          : (btn.dataset.labelSystem || "Dark mode");
    });
  }

  var lastResolved = resolveTheme(getPreference());

  function applyThemeAndMaybeReloadDocs() {
    var next = resolveTheme(getPreference());
    applyTheme();
    if (next !== lastResolved && (document.querySelector("app-root") || document.querySelector("app-shell"))) {
      lastResolved = next;
      location.reload();
      return;
    }
    lastResolved = next;
  }

  function cycleTheme() {
    var order = ["light", "dark", "system"];
    var pref = getPreference();
    var next = order[(order.indexOf(pref) + 1) % order.length];
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    applyThemeAndMaybeReloadDocs();
  }

  applyTheme();
  lastResolved = resolveTheme(getPreference());

  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (getPreference() === "system") applyThemeAndMaybeReloadDocs();
    });
  } catch (_) {}

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    e.preventDefault();
    cycleTheme();
  });

  window.inimarkApplySiteTheme = applyTheme;
  window.inimarkSetSiteTheme = function (pref) {
    if (pref !== "light" && pref !== "dark" && pref !== "system") return;
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch (_) {}
    applyThemeAndMaybeReloadDocs();
  };
})();
