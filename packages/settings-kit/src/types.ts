export interface SettingSearchItem {
  id: string;
  section: string;
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

export interface SettingsRenderContext {
  /** Re-render the active section (or search results). */
  refreshContent(): void;
  /** Main column wrap — useful for toasts / drop targets. */
  mainHost: HTMLElement;
}

/**
 * Product section registered with the settings shell.
 * Panel bodies stay in the app; the kit only owns navigation chrome.
 */
export interface SettingsSectionDef {
  id: string;
  title: () => string;
  /** Optional subtitle used when matching section-level search. */
  subtitle?: () => string;
  icon?: () => string;
  /** When false, the section is omitted from the nav. Default: visible. */
  visible?: () => boolean;
  render(body: HTMLElement, ctx: SettingsRenderContext): void | (() => void);
  searchEntries?: () => SettingSearchItem[];
}

export interface SettingsViewController {
  navigateToSection(sectionId: string): void;
  refresh(): void;
  destroy(): void;
}

export interface SettingsViewStrings {
  searchPlaceholder: () => string;
  noMatch: () => string;
  focusSearchHint: () => string;
}

export interface SettingsSearchAdapter {
  /** Run a free-text search across settings. */
  search(query: string): SettingSearchMatch[];
  /** Whether a nav section should remain visible for the current query. */
  sectionHasMatch(sectionId: string, query: string): boolean;
  /** Render query matches inside a text node parent. */
  appendHighlightedText(parent: HTMLElement, text: string, query: string): void;
  resolveItemTitle?(item: SettingSearchItem): string;
  resolveItemDescription?(item: SettingSearchItem): string;
}

export interface MountSettingsViewOptions {
  sections: SettingsSectionDef[];
  strings: SettingsViewStrings;
  /** Mount product titlebar into the main topbar host; return destroy. */
  mountTitleBar: (host: HTMLElement) => { destroy(): void };
  search: SettingsSearchAdapter;
  defaultSectionId?: string;
  /** Called at the start of `refresh()` so the app can reload external state. */
  onBeforeRefresh?: () => void;
  /**
   * When navigating to a section that is not currently visible, map to a fallback.
   * Default: first visible section.
   */
  resolveFallbackSection?: (requestedId: string) => string;
  /** Locale / dictionary change subscription. */
  onLocaleChange?: (listener: () => void) => () => void;
  /** After jumping to a search hit, optionally tweak highlight (e.g. switch tabs). */
  onHighlightSetting?: (content: HTMLElement, settingId: string) => void;
  focusSearchKeys?: string[];
  matchShortcut?: (event: KeyboardEvent, keys: string[]) => boolean;
  formatShortcutDisplay?: (keys: string[]) => string;
  isShortcutRecordingActive?: () => boolean;
  navWidthKey?: string;
  navWidthDefault?: number;
  navWidthMin?: number;
  navWidthMax?: number;
}
