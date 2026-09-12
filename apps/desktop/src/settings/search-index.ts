import { t } from "../i18n/index.ts";
import { DEFAULT_SHORTCUTS } from "../shortcuts/defaults.ts";
import { formatShortcutDisplay, loadShortcuts } from "../shortcuts/store.ts";
import { shortcutActionLabel } from "./shortcuts-panel.ts";
import { loadSettings } from "./store.ts";

export type SettingsSection =
  | "editor"
  | "appearance"
  | "theme"
  | "shortcuts"
  | "libraries"
  | "publish"
  | "image"
  | "graph"
  | "about"
  | "dev";

const SETTINGS_SECTIONS: SettingsSection[] = [
  "editor",
  "appearance",
  "theme",
  "shortcuts",
  "libraries",
  "publish",
  "image",
  "graph",
  "about",
  "dev",
];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as string[]).includes(value);
}

export interface SettingSearchItem {
  id: string;
  section: SettingsSection;
  titleKey?: string;
  descKey?: string;
  getTitle?: () => string;
  getDescription?: () => string;
  /** Extra localized or symbolic terms (e.g. shortcut key combos). */
  keywords?: string[];
}

export interface SettingSearchMatch {
  item: SettingSearchItem;
  score: number;
}

type StaticEntry = Omit<
  SettingSearchItem,
  "getTitle" | "getDescription"
> & {
  titleKey: string;
};

const STATIC_ENTRIES: StaticEntry[] = [
  // Editor
  { id: "editor.editorFont", section: "editor", titleKey: "settings.editor.editorFont", descKey: "settings.editor.editorFontDesc" },
  { id: "editor.codeFont", section: "editor", titleKey: "settings.editor.codeFont", descKey: "settings.editor.codeFontDesc" },
  { id: "editor.fontSize", section: "editor", titleKey: "settings.editor.fontSize", descKey: "settings.editor.fontSizeDesc" },
  { id: "editor.codeFontSize", section: "editor", titleKey: "settings.editor.codeFontSize", descKey: "settings.editor.codeFontSizeDesc" },
  { id: "editor.lineHeight", section: "editor", titleKey: "settings.editor.lineHeight", descKey: "settings.editor.lineHeightDesc" },
  { id: "editor.paragraphSpacing", section: "editor", titleKey: "settings.editor.paragraphSpacing", descKey: "settings.editor.paragraphSpacingDesc" },
  { id: "editor.codeLineHeight", section: "editor", titleKey: "settings.editor.codeLineHeight", descKey: "settings.editor.codeLineHeightDesc" },
  { id: "editor.editorWidth", section: "editor", titleKey: "settings.editor.editorWidth", descKey: "settings.editor.editorWidthDesc" },
  { id: "editor.typewriter", section: "editor", titleKey: "settings.editor.typewriter", descKey: "settings.editor.typewriterDesc" },
  { id: "editor.focus", section: "editor", titleKey: "settings.editor.focus", descKey: "settings.editor.focusDesc" },
  { id: "editor.firstLineIndent", section: "editor", titleKey: "settings.editor.firstLineIndent", descKey: "settings.editor.firstLineIndentDesc" },
  { id: "editor.autoHideStatusbar", section: "editor", titleKey: "settings.editor.autoHideStatusbar", descKey: "settings.editor.autoHideStatusbarDesc" },
  { id: "editor.autoHideTitlebar", section: "editor", titleKey: "settings.editor.autoHideTitlebar", descKey: "settings.editor.autoHideTitlebarDesc" },
  { id: "editor.autoSave", section: "editor", titleKey: "settings.editor.autoSave", descKey: "settings.editor.autoSaveDesc" },
  { id: "editor.autoSaveDelay", section: "editor", titleKey: "settings.editor.autoSaveDelay", descKey: "settings.editor.autoSaveDelayDesc" },
  { id: "editor.linkUpdateOnMove", section: "editor", titleKey: "settings.editor.linkUpdateOnMove", descKey: "settings.editor.linkUpdateOnMoveDesc" },
  { id: "editor.wikiLinkPreviewTrigger", section: "editor", titleKey: "settings.editor.wikiLinkPreviewTrigger", descKey: "settings.editor.wikiLinkPreviewTriggerDesc" },
  { id: "editor.formatOnSave", section: "editor", titleKey: "settings.editor.formatOnSave", descKey: "settings.editor.formatOnSaveDesc" },
  { id: "editor.cjkSpacing", section: "editor", titleKey: "settings.editor.cjkSpacing", descKey: "settings.editor.cjkSpacingDesc" },
  { id: "editor.trimTrailing", section: "editor", titleKey: "settings.editor.trimTrailing", descKey: "settings.editor.trimTrailingDesc" },
  { id: "editor.finalNewline", section: "editor", titleKey: "settings.editor.finalNewline", descKey: "settings.editor.finalNewlineDesc" },
  { id: "editor.collapseBlank", section: "editor", titleKey: "settings.editor.collapseBlank", descKey: "settings.editor.collapseBlankDesc" },
  // Appearance
  { id: "appearance.locale", section: "appearance", titleKey: "settings.language.title", descKey: "settings.language.desc" },
  { id: "appearance.uiFont", section: "appearance", titleKey: "settings.appearance.uiFont", descKey: "settings.appearance.uiFontDesc" },
  { id: "appearance.menuDensity", section: "appearance", titleKey: "settings.appearance.menuDensity", descKey: "settings.appearance.menuDensityDesc" },
  { id: "appearance.autoHideLibraryBar", section: "appearance", titleKey: "settings.appearance.autoHideLibraryBar", descKey: "settings.appearance.autoHideLibraryBarDesc" },
  { id: "appearance.showFileTreeIcons", section: "appearance", titleKey: "settings.appearance.showFileTreeIcons", descKey: "settings.appearance.showFileTreeIconsDesc" },
  { id: "appearance.sidebarTabs", section: "appearance", titleKey: "settings.appearance.sidebarTabs", descKey: "settings.appearance.sidebarTabsDesc" },
  // Theme
  { id: "theme.appearanceMode", section: "theme", titleKey: "settings.theme.appearanceMode", descKey: "settings.theme.appearanceModeDesc" },
  { id: "theme.glassEffect", section: "theme", titleKey: "settings.theme.glassEffect", descKey: "settings.theme.glassEffectDesc" },
  { id: "theme.appTheme", section: "theme", titleKey: "settings.theme.appTheme", descKey: "settings.subtitle.theme" },
  { id: "theme.codeTheme", section: "theme", titleKey: "settings.theme.codeTheme", descKey: "settings.subtitle.theme" },
  // Image
  { id: "image.storageMode", section: "image", titleKey: "settings.image.storageMode", descKey: "settings.image.storageModeDesc" },
  { id: "image.filenameFormat", section: "image", titleKey: "settings.image.filenameFormat", descKey: "settings.image.filenameFormatDesc" },
  { id: "image.autoCreate", section: "image", titleKey: "settings.image.autoCreate", descKey: "settings.image.autoCreateDesc" },
  { id: "image.storagePath", section: "image", titleKey: "settings.image.storagePath", descKey: "settings.image.storagePathDesc" },
  // Graph
  { id: "graph.showArrows", section: "graph", titleKey: "settings.graph.showArrows", descKey: "settings.graph.showArrowsDesc" },
  { id: "graph.textOpacity", section: "graph", titleKey: "settings.graph.textOpacity", descKey: "settings.graph.textOpacityDesc" },
  { id: "graph.nodeSize", section: "graph", titleKey: "settings.graph.nodeSize", descKey: "settings.graph.nodeSizeDesc" },
  { id: "graph.linkThickness", section: "graph", titleKey: "settings.graph.linkThickness", descKey: "settings.graph.linkThicknessDesc" },
  { id: "graph.animate", section: "graph", titleKey: "settings.graph.animate", descKey: "settings.graph.animateDesc" },
  { id: "graph.centerForce", section: "graph", titleKey: "settings.graph.centerForce", descKey: "settings.graph.centerForceDesc" },
  { id: "graph.repulsion", section: "graph", titleKey: "settings.graph.repulsion", descKey: "settings.graph.repulsionDesc" },
  { id: "graph.linkForce", section: "graph", titleKey: "settings.graph.linkForce", descKey: "settings.graph.linkForceDesc" },
  { id: "graph.linkDistance", section: "graph", titleKey: "settings.graph.linkDistance", descKey: "settings.graph.linkDistanceDesc" },
  // Libraries
  { id: "libraries.manage", section: "libraries", titleKey: "settings.nav.libraries", descKey: "settings.subtitle.libraries" },
  { id: "libraries.add", section: "libraries", titleKey: "settings.libraries.add", descKey: "settings.libraries.empty" },
  // Publish
  { id: "publish.library", section: "publish", titleKey: "settings.publish.library", descKey: "settings.publish.libraryDesc" },
  { id: "publish.siteName", section: "publish", titleKey: "settings.publish.siteName", descKey: "settings.publish.siteNameDesc" },
  { id: "publish.lightTheme", section: "publish", titleKey: "settings.publish.lightTheme", descKey: "settings.publish.lightThemeDesc" },
  { id: "publish.darkTheme", section: "publish", titleKey: "settings.publish.darkTheme", descKey: "settings.publish.darkThemeDesc" },
  { id: "publish.lightCodeTheme", section: "publish", titleKey: "settings.publish.lightCodeTheme", descKey: "settings.publish.lightCodeThemeDesc" },
  { id: "publish.darkCodeTheme", section: "publish", titleKey: "settings.publish.darkCodeTheme", descKey: "settings.publish.darkCodeThemeDesc" },
  { id: "publish.out", section: "publish", titleKey: "settings.publish.out", descKey: "settings.publish.outDesc" },
  { id: "publish.baseHref", section: "publish", titleKey: "settings.publish.baseHref", descKey: "settings.publish.baseHrefDesc" },
  { id: "publish.home", section: "publish", titleKey: "settings.publish.home", descKey: "settings.publish.homeDesc" },
  // About
  { id: "about.version", section: "about", titleKey: "settings.about.versionInfo", descKey: "settings.subtitle.about" },
  { id: "about.updates", section: "about", titleKey: "settings.about.softwareUpdate", descKey: "settings.about.checkUpdates" },
  { id: "about.useSystemProxy", section: "about", titleKey: "settings.about.useSystemProxy", descKey: "settings.about.useSystemProxyDesc" },
  { id: "about.license", section: "about", titleKey: "settings.about.openSourceLicense", descKey: "settings.about.licenseName" },
  { id: "about.github", section: "about", titleKey: "settings.about.github", descKey: "settings.about.desc" },
  { id: "about.email", section: "about", titleKey: "settings.about.email", descKey: "settings.about.desc" },
  { id: "about.showDev", section: "about", titleKey: "settings.about.showDevSection", descKey: "settings.about.showDevSectionDesc" },
  // Dev (dev builds only)
  { id: "dev.docs.publish", section: "dev", titleKey: "settings.dev.docs.group", descKey: "settings.dev.docs.intro" },
  { id: "dev.docs.lightTheme", section: "dev", titleKey: "settings.publish.lightTheme", descKey: "settings.publish.lightThemeDesc" },
  { id: "dev.docs.darkTheme", section: "dev", titleKey: "settings.publish.darkTheme", descKey: "settings.publish.darkThemeDesc" },
  { id: "dev.docs.lightCodeTheme", section: "dev", titleKey: "settings.publish.lightCodeTheme", descKey: "settings.publish.lightCodeThemeDesc" },
  { id: "dev.docs.darkCodeTheme", section: "dev", titleKey: "settings.publish.darkCodeTheme", descKey: "settings.publish.darkCodeThemeDesc" },
  { id: "dev.updateOverride", section: "dev", titleKey: "settings.dev.updateOverrideTitle", descKey: "settings.dev.updateOverrideDesc" },
  { id: "dev.triggerBackgroundCheck", section: "dev", titleKey: "settings.dev.triggerBackgroundCheck", descKey: "settings.dev.updateIntro" },
  { id: "dev.runLocalCheck", section: "dev", titleKey: "settings.dev.runLocalCheck", descKey: "settings.dev.checkStatusTitle" },
  { id: "dev.openAboutUpdate", section: "dev", titleKey: "settings.dev.openAboutUpdate", descKey: "settings.dev.updateIntro" },
];

function shortcutEntries(): SettingSearchItem[] {
  const bindings = loadShortcuts();
  return DEFAULT_SHORTCUTS.map((def) => {
    const current = bindings.find((entry) => entry.id === def.id) ?? def;
    const keysLabel = formatShortcutDisplay(current.keys);
    return {
      id: `shortcut.${def.id}`,
      section: "shortcuts",
      getTitle: () => shortcutActionLabel(def.id, def.label),
      getDescription: () => keysLabel,
      keywords: [keysLabel, def.label, def.id],
    };
  });
}

/** Whether the Dev settings section should appear (dev build + user preference). */
export function isDevSettingsVisible(): boolean {
  return Boolean(import.meta.env.DEV) && loadSettings().showDevSection;
}

export function listSettingSearchItems(): SettingSearchItem[] {
  const staticItems: SettingSearchItem[] = STATIC_ENTRIES.map((entry) => ({
    ...entry,
    getTitle: () => t(entry.titleKey),
    getDescription: () => (entry.descKey ? t(entry.descKey) : ""),
  }));
  return [...staticItems, ...shortcutEntries()].filter((item) => {
    if (item.section === "dev") return isDevSettingsVisible();
    if (item.id === "about.showDev") return Boolean(import.meta.env.DEV);
    return true;
  });
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFKC");
}

function tokenizeQuery(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** Case-insensitive match ranges for query tokens within `text` (display string). */
export function collectSearchHighlightRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const tokens = tokenizeQuery(query);
  if (!tokens.length || !text) return [];

  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(token, from);
      if (index < 0) break;
      ranges.push([index, index + token.length]);
      from = index + Math.max(1, token.length);
    }
  }
  if (!ranges.length) return [];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }
  return merged;
}

/** Append `text` into `parent`, wrapping query matches in `<mark>`. */
export function appendHighlightedSearchText(
  parent: HTMLElement,
  text: string,
  query: string,
): void {
  parent.replaceChildren();
  const ranges = collectSearchHighlightRanges(text, query);
  if (!ranges.length) {
    parent.textContent = text;
    return;
  }

  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      parent.append(document.createTextNode(text.slice(cursor, start)));
    }
    const mark = document.createElement("mark");
    mark.className = "inimark-settings-search-mark";
    mark.textContent = text.slice(start, end);
    parent.append(mark);
    cursor = end;
  }
  if (cursor < text.length) {
    parent.append(document.createTextNode(text.slice(cursor)));
  }
}

function sectionLabel(section: SettingsSection): string {
  return t(`settings.nav.${section}`);
}

function sectionSubtitle(section: SettingsSection): string {
  return t(`settings.subtitle.${section}`);
}

function itemHaystack(item: SettingSearchItem): string {
  const title = item.getTitle?.() ?? (item.titleKey ? t(item.titleKey) : "");
  const desc =
    item.getDescription?.() ?? (item.descKey ? t(item.descKey) : "");
  const extra = (item.keywords ?? []).join(" ");
  return [title, desc, sectionLabel(item.section), sectionSubtitle(item.section), extra]
    .filter(Boolean)
    .join(" ");
}

function matchScore(haystack: string, tokens: string[]): number {
  const normalized = normalizeText(haystack);
  if (!tokens.every((token) => normalized.includes(token))) return 0;

  const titlePart = normalizeText(haystack.split("\n")[0] ?? haystack);
  let score = 10;
  for (const token of tokens) {
    if (titlePart === token) score += 100;
    else if (titlePart.startsWith(token)) score += 60;
    else if (titlePart.includes(token)) score += 30;
    else score += 5;
  }
  return score;
}

export function searchSettings(query: string): SettingSearchMatch[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const results: SettingSearchMatch[] = [];
  for (const item of listSettingSearchItems()) {
    const title = item.getTitle?.() ?? (item.titleKey ? t(item.titleKey) : "");
    const desc =
      item.getDescription?.() ?? (item.descKey ? t(item.descKey) : "");
    const haystack = `${title}\n${desc}\n${itemHaystack(item)}`;
    const score = matchScore(haystack, tokens);
    if (score > 0) results.push({ item, score });
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const titleA = a.item.getTitle?.() ?? "";
    const titleB = b.item.getTitle?.() ?? "";
    return titleA.localeCompare(titleB);
  });
}

export function sectionsMatchingSearch(query: string): Set<SettingsSection> {
  const matches = searchSettings(query);
  return new Set(matches.map(({ item }) => item.section));
}

export function sectionHasSearchMatch(section: SettingsSection, query: string): boolean {
  if (section === "dev" && !isDevSettingsVisible()) return false;

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;

  const sectionHaystack = [
    sectionLabel(section),
    sectionSubtitle(section),
  ].join(" ");
  if (tokens.every((token) => normalizeText(sectionHaystack).includes(token))) {
    return true;
  }

  return sectionsMatchingSearch(query).has(section);
}
