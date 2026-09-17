import {
  attachColumnResize,
  createNavItem,
  createNavList,
  createSearchField,
  loadPersistedWidth,
  persistWidth,
  setNavItemLabel,
} from "@dionysen/ui";
import type {
  MountSettingsViewOptions,
  SettingSearchItem,
  SettingsRenderContext,
  SettingsSectionDef,
  SettingsViewController,
} from "./types.ts";

const DEFAULT_NAV_WIDTH_KEY = "dionysen-settings-nav-width";
const DEFAULT_NAV_WIDTH = 220;
const DEFAULT_NAV_WIDTH_MIN = 160;
const DEFAULT_NAV_WIDTH_MAX = 420;
const DEFAULT_FOCUS_SEARCH_KEYS = ["Ctrl", "F"];

function defaultFormatShortcutDisplay(keys: string[]): string {
  return keys.join("+");
}

function defaultMatchShortcut(event: KeyboardEvent, keys: string[]): boolean {
  const required = keys.map((key) => key.toLowerCase());
  const hasCtrl = required.includes("ctrl");
  const hasShift = required.includes("shift");
  const hasAlt = required.includes("alt");
  const primaryMod = event.ctrlKey || event.metaKey;
  if (hasCtrl !== primaryMod) return false;
  if (hasShift !== event.shiftKey) return false;
  if (hasAlt !== event.altKey) return false;
  const mainKey = required.find(
    (key) => !["ctrl", "shift", "alt", "meta", "cmd"].includes(key),
  );
  if (!mainKey) return false;
  return event.key.toLowerCase() === mainKey;
}

/**
 * Mount the settings chrome (nav, search, section switching, resize, locale refresh).
 * Product panels are supplied via `sections[].render` — the kit never owns panel bodies.
 */
export function mountSettingsView(
  host: HTMLElement,
  options: MountSettingsViewOptions,
): SettingsViewController {
  const sections = options.sections;
  const strings = options.strings;
  const searchAdapter = options.search;
  const focusKeys = options.focusSearchKeys ?? DEFAULT_FOCUS_SEARCH_KEYS;
  const matchShortcut = options.matchShortcut ?? defaultMatchShortcut;
  const formatShortcutDisplay =
    options.formatShortcutDisplay ?? defaultFormatShortcutDisplay;
  const isRecording = options.isShortcutRecordingActive ?? (() => false);
  const navWidthKey = options.navWidthKey ?? DEFAULT_NAV_WIDTH_KEY;
  const navWidthDefault = options.navWidthDefault ?? DEFAULT_NAV_WIDTH;
  const navWidthMin = options.navWidthMin ?? DEFAULT_NAV_WIDTH_MIN;
  const navWidthMax = options.navWidthMax ?? DEFAULT_NAV_WIDTH_MAX;

  let activeSectionId =
    options.defaultSectionId ?? visibleSections()[0]?.id ?? sections[0]?.id ?? "";
  let searchQuery = "";
  let pendingHighlightId: string | null = null;
  let navWidth = loadPersistedWidth(
    navWidthKey,
    navWidthDefault,
    navWidthMin,
    navWidthMax,
  );
  let sectionCleanup: (() => void) | null = null;

  host.className = "inimark-settings-shell";
  host.replaceChildren();

  const layout = document.createElement("div");
  layout.className = "inimark-settings-layout";

  const nav = document.createElement("nav");
  nav.className = "inimark-settings-nav";

  const navTopbar = document.createElement("div");
  navTopbar.className = "inimark-settings-nav-topbar";
  navTopbar.setAttribute("data-tauri-drag-region", "");

  const navBody = document.createElement("div");
  navBody.className = "inimark-settings-nav-body inimark-scrollbar";

  const search = createSearchField({
    placeholder: strings.searchPlaceholder(),
    onInput(value) {
      searchQuery = value;
      renderNav();
      renderContent();
    },
  });

  search.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = searchAdapter.search(searchQuery)[0];
    if (!first) return;
    event.preventDefault();
    navigateToSetting(first.item);
  });

  const navList = createNavList();
  const navButtons = new Map<string, HTMLButtonElement>();

  function visibleSections(): SettingsSectionDef[] {
    return sections.filter((section) => section.visible?.() !== false);
  }

  function sectionById(id: string): SettingsSectionDef | undefined {
    return sections.find((section) => section.id === id);
  }

  function resolveVisibleSection(id: string): string {
    const visible = visibleSections();
    if (visible.some((section) => section.id === id)) return id;
    if (options.resolveFallbackSection) {
      const fallback = options.resolveFallbackSection(id);
      if (visible.some((section) => section.id === fallback)) return fallback;
    }
    return visible[0]?.id ?? sections[0]?.id ?? id;
  }

  function rebuildNavButtons(): void {
    navButtons.clear();
    navList.replaceChildren();
    for (const section of visibleSections()) {
      const btn = createNavItem({
        id: section.id,
        label: section.title(),
        icon: section.icon?.() ?? "",
        onClick() {
          activeSectionId = section.id;
          renderNav();
          renderContent();
        },
      });
      navButtons.set(section.id, btn);
      navList.append(btn);
    }
  }

  rebuildNavButtons();
  navBody.append(search.el, navList);

  const navFooter = document.createElement("div");
  navFooter.className = "inimark-settings-nav-footer";

  const searchHint = document.createElement("p");
  searchHint.className = "inimark-settings-nav-hint";
  const searchHintKbd = document.createElement("kbd");
  const searchHintLabel = document.createElement("span");
  searchHintLabel.className = "inimark-settings-nav-hint-label";

  function renderSearchHint(): void {
    searchHintKbd.textContent = formatShortcutDisplay(focusKeys).replace(/\+/g, "-");
    searchHintLabel.textContent = strings.focusSearchHint();
  }

  renderSearchHint();
  searchHint.append(searchHintKbd, searchHintLabel);
  navFooter.append(searchHint);
  nav.append(navTopbar, navBody, navFooter);

  function onFocusSearchKeyDown(event: KeyboardEvent): void {
    if (!matchShortcut(event, focusKeys)) return;
    if (isRecording()) return;
    event.preventDefault();
    event.stopPropagation();
    search.focus();
    search.input.select();
  }

  window.addEventListener("keydown", onFocusSearchKeyDown, true);

  const mainWrap = document.createElement("div");
  mainWrap.className = "inimark-settings-main-wrap";

  const mainTopbar = document.createElement("header");
  const titlebar = options.mountTitleBar(mainTopbar);

  const main = document.createElement("div");
  main.className = "inimark-settings-main inimark-scrollbar";

  const content = document.createElement("div");
  content.className = "inimark-settings-content";

  main.append(content);
  mainWrap.append(mainTopbar, main);
  layout.append(nav, mainWrap);
  host.append(layout);

  function applyNavWidth(): void {
    layout.style.setProperty("--inimark-settings-nav-width", `${navWidth}px`);
  }

  applyNavWidth();

  const resize = attachColumnResize(nav, {
    side: "left",
    minWidth: navWidthMin,
    maxWidth: navWidthMax,
    getWidth: () => navWidth,
    onWidthChange(width) {
      navWidth = width;
      applyNavWidth();
      persistWidth(navWidthKey, width);
    },
  });

  const ctx: SettingsRenderContext = {
    refreshContent: () => renderContent(),
    mainHost: mainWrap,
  };

  function renderNav(): void {
    let visible = 0;
    for (const [id, btn] of navButtons) {
      const match = searchAdapter.sectionHasMatch(id, searchQuery);
      btn.hidden = !match;
      btn.classList.toggle(
        "is-active",
        searchQuery.trim().length === 0 && id === activeSectionId,
      );
      const section = sectionById(id);
      if (section) setNavItemLabel(btn, section.title());
      if (match) visible += 1;
    }
    const querying = searchQuery.trim().length > 0;
    navList.hidden = querying && visible === 0;
  }

  function itemTitle(item: SettingSearchItem): string {
    return (
      searchAdapter.resolveItemTitle?.(item) ??
      item.getTitle?.() ??
      item.titleKey ??
      ""
    );
  }

  function itemDescription(item: SettingSearchItem): string {
    return (
      searchAdapter.resolveItemDescription?.(item) ??
      item.getDescription?.() ??
      item.descKey ??
      ""
    );
  }

  function highlightSettingRow(id: string): void {
    requestAnimationFrame(() => {
      options.onHighlightSetting?.(content, id);

      let row = content.querySelector<HTMLElement>(`[data-setting-id="${id}"]`);
      if (!row && id === "theme.codeTheme") {
        row = content.querySelector<HTMLElement>(".theme-kind-tabs");
      }
      if (!row) return;

      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.add("is-search-highlight");
      window.setTimeout(() => row.classList.remove("is-search-highlight"), 2200);
    });
  }

  function navigateToSection(sectionId: string): void {
    searchQuery = "";
    search.setValue("");
    activeSectionId = resolveVisibleSection(sectionId);
    pendingHighlightId = null;
    renderNav();
    renderContent();
  }

  function navigateToSetting(item: SettingSearchItem): void {
    searchQuery = "";
    search.setValue("");
    activeSectionId = resolveVisibleSection(item.section);
    pendingHighlightId = item.id;
    renderNav();
    renderContent();
  }

  function renderSearchResults(body: HTMLElement): void {
    const matches = searchAdapter.search(searchQuery);
    const results = document.createElement("div");
    results.className = "inimark-settings-search-results";

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "inimark-settings-search-empty";
      empty.textContent = strings.noMatch();
      results.append(empty);
      body.append(results);
      return;
    }

    for (const { item } of matches) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inimark-settings-search-result";

      const title = document.createElement("div");
      title.className = "inimark-settings-search-result-title";
      searchAdapter.appendHighlightedText(title, itemTitle(item), searchQuery);

      const desc = document.createElement("div");
      desc.className = "inimark-settings-search-result-desc";
      const description = itemDescription(item);
      if (description) {
        searchAdapter.appendHighlightedText(desc, description, searchQuery);
      }

      const sectionEl = document.createElement("div");
      sectionEl.className = "inimark-settings-search-result-section";
      const section = sectionById(item.section);
      searchAdapter.appendHighlightedText(
        sectionEl,
        section?.title() ?? item.section,
        searchQuery,
      );

      btn.append(title);
      if (description) btn.append(desc);
      btn.append(sectionEl);
      btn.addEventListener("click", () => navigateToSetting(item));
      results.append(btn);
    }

    body.append(results);
  }

  function renderContent(): void {
    sectionCleanup?.();
    sectionCleanup = null;
    content.replaceChildren();

    const body = document.createElement("div");
    body.className = "inimark-settings-body";

    if (searchQuery.trim().length > 0) {
      renderSearchResults(body);
      content.append(body);
      return;
    }

    const section = sectionById(activeSectionId);
    if (section && section.visible?.() !== false) {
      const cleanup = section.render(body, ctx);
      if (typeof cleanup === "function") sectionCleanup = cleanup;
    }

    content.append(body);

    if (pendingHighlightId) {
      const id = pendingHighlightId;
      pendingHighlightId = null;
      highlightSettingRow(id);
    }
  }

  activeSectionId = resolveVisibleSection(activeSectionId);
  renderNav();
  renderContent();

  const unsubscribeLocale = options.onLocaleChange?.(() => {
    search.input.placeholder = strings.searchPlaceholder();
    search.input.setAttribute("aria-label", strings.searchPlaceholder());
    renderSearchHint();
    renderNav();
    renderContent();
  });

  return {
    navigateToSection,
    refresh() {
      const prevVisible = visibleSections()
        .map((section) => section.id)
        .join("\0");
      options.onBeforeRefresh?.();
      const nextVisible = visibleSections()
        .map((section) => section.id)
        .join("\0");
      activeSectionId = resolveVisibleSection(activeSectionId);
      if (prevVisible !== nextVisible) {
        rebuildNavButtons();
      }
      search.input.placeholder = strings.searchPlaceholder();
      search.input.setAttribute("aria-label", strings.searchPlaceholder());
      renderNav();
      renderContent();
    },
    destroy() {
      window.removeEventListener("keydown", onFocusSearchKeyDown, true);
      unsubscribeLocale?.();
      resize.destroy();
      titlebar.destroy();
      search.destroy();
      sectionCleanup?.();
      host.replaceChildren();
      host.className = "";
    },
  };
}
