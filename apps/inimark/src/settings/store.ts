import {
  applyEditorTypographyCss,
  createJsonSettingsStore,
  type JsonSettingsStore,
  type SettingsSyncPayload as KitSettingsSyncPayload,
} from "@dionysen/settings-kit";
import {
  FONT_PRESETS,
  type FontPresetId,
  isValidFontSetting,
  normalizeFontValue,
  resolveFontValue,
} from "./system-fonts.ts";
import {
  detectSystemLocale,
  setLocale,
  t,
  type LocaleId,
} from "../i18n/index.ts";
import {
  DEFAULT_LEFT_SIDEBAR_TABS,
  DEFAULT_RIGHT_SIDEBAR_TABS,
  normalizeSidebarTabLayout,
  type SidebarTabId,
} from "../sidebar/tab-layout.ts";
import {
  isUsableGraphColor,
  paletteColorAt,
  normalizeColorGroupRule,
  type GraphColorGroup,
} from "../graph/index.ts";

export type { SidebarTabId, GraphColorGroup };
export { paletteColorAt };

export const EDITOR_WIDTH_MIN = 480;
export const EDITOR_WIDTH_MAX = 1280;
export const EDITOR_WIDTH_DEFAULT = 768;

export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 36;

export const CODE_INDENT_SIZE_MIN = 1;
export const CODE_INDENT_SIZE_MAX = 8;
export const CODE_INDENT_SIZE_DEFAULT = 2;

export type AutoSaveDelayUnit = "s" | "min" | "h";

export const AUTO_SAVE_DELAY_MS_DEFAULT = 900;
export const AUTO_SAVE_DELAY_MS_MIN = 500;
export const AUTO_SAVE_DELAY_MS_MAX = 24 * 60 * 60 * 1000;

export type AppearanceMode = "light" | "dark" | "system";
export type MenuDensity = "compact" | "normal" | "comfortable";
export type ImageStorageMode = "library-assets" | "fixed-directory";
export type ImageFilenameFormat = "original" | "timestamp" | "both";
export type AppLocale = "en" | "zh-CN" | "system";
/** Wiki-link rewrite preference after move/rename. */
export type LinkUpdateMode = "ask" | "always" | "never";
/** Wiki-link note preview trigger (mirrors editor WikiLinkPreviewTrigger). */
export type WikiLinkPreviewTrigger = "modifier" | "hover";

export type { FontPresetId };
export { FONT_PRESETS };

export interface MarkdownFormatSettings {
  formatOnSave: boolean;
  cjkSpacing: boolean;
  trimTrailingWhitespace: boolean;
  ensureFinalNewline: boolean;
  normalizeBlankLines: boolean;
}

export interface ImageSettings {
  storageMode: ImageStorageMode;
  filenameFormat: ImageFilenameFormat;
  autoCreateAssetsDir: boolean;
  fixedDirectoryPath: string;
}

/** Relationship graph appearance + force layout (0–100 sliders). */
export interface WordCountSettings {
  /** When true, count raw Markdown (symbols included). Otherwise count plain text only. */
  includeSymbols: boolean;
}

export interface GraphSettings {
  showArrows: boolean;
  /** Label fade: 50 = hide names when zoomed out; 0 = always show; 100 = hide until zoomed in. */
  textOpacity: number;
  /** Node radius scale 0–100 (50 ≈ default). */
  nodeSize: number;
  /** Edge stroke scale 0–100 (50 ≈ default). */
  linkThickness: number;
  /** Keep the force simulation running. */
  animate: boolean;
  /** Pull toward center 0–100 (50 ≈ default). */
  centerForce: number;
  /** Node–node repulsion 0–100 (50 ≈ default). */
  repulsion: number;
  /** Spring strength between linked nodes 0–100 (50 ≈ default). */
  linkForce: number;
  /** Preferred link length 0–100 (50 ≈ default). */
  linkDistance: number;
  /** Ordered color groups (first matching query wins). */
  colorGroups: GraphColorGroup[];
}

export interface AppSettings {
  /** UI language. `system` follows OS locale. */
  locale: AppLocale;
  fontSize: number;
  codeFontSize: number;
  editorWidth: number;
  appearance: AppearanceMode;
  editorFont: string;
  codeFont: string;
  uiFont: string;
  lineHeight: number;
  paragraphSpacing: number;
  codeLineHeight: number;
  /**
   * Spaces per indent level for fenced-code Tab and auto-indent.
   */
  codeIndentSize: number;
  typewriterMode: boolean;
  /** Dim blocks away from the caret so the active paragraph stands out. */
  focusMode: boolean;
  /**
   * Display-only first-line indent (~2 CJK em) on top-level paragraphs in Markdown.
   * Not stored in the file; lists / quotes stay unindented.
   */
  firstLineIndentMarkdown: boolean;
  /**
   * Display-only first-line indent for plain-text (`.txt`) notes.
   * Defaults on — typography-focused plain writing.
   */
  firstLineIndentPlaintext: boolean;
  /** Hide bottom-right status bar tools until the pointer enters that corner. */
  autoHideStatusbar: boolean;
  /** Collapse the editor titlebar until the pointer enters the top edge. */
  autoHideTitlebar: boolean;
  /** Pin the editor graph-view control to the left of the titlebar More button. */
  pinGraphViewInTitlebar: boolean;
  autoSave: boolean;
  /** Milliseconds to wait after edits before auto-saving. */
  autoSaveDelayMs: number;
  /** When notes are moved/renamed and other files link to them. */
  linkUpdateOnMove: LinkUpdateMode;
  /** Wiki-link preview: Ctrl/⌘+hover, or plain hover. */
  wikiLinkPreviewTrigger: WikiLinkPreviewTrigger;
  markdownFormat: MarkdownFormatSettings;
  menuDensity: MenuDensity;
  autoHideLibraryBar: boolean;
  /** Ordered tabs shown in the left sidebar. */
  leftSidebarTabs: SidebarTabId[];
  /** Ordered tabs shown in the right sidebar. */
  rightSidebarTabs: SidebarTabId[];
  /** Show folder/file icons before names in the explorer tree. */
  showFileTreeIcons: boolean;
  /** Frosted glass for menus. Floating library chrome is always frosted. */
  glassEffect: boolean;
  image: ImageSettings;
  graph: GraphSettings;
  wordCount: WordCountSettings;
  /** When true, app updates use the OS / user proxy settings. */
  useSystemProxyForUpdates: boolean;
  /**
   * Show the Dev settings section in the sidebar.
   * Only meaningful in development builds; ignored in production.
   */
  showDevSection: boolean;
}

export const SETTINGS_STORAGE_KEY = "inimark:settings";
/** Cross-window live sync (Tauri). Browser / same-origin popups still use `storage`. */
export const SETTINGS_SYNC_EVENT = "settings-changed";

export type SettingsSyncPayload = KitSettingsSyncPayload<AppSettings>;

export const DEFAULT_MARKDOWN_FORMAT: MarkdownFormatSettings = {
  formatOnSave: false,
  cjkSpacing: false,
  trimTrailingWhitespace: true,
  ensureFinalNewline: true,
  normalizeBlankLines: true,
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  storageMode: "library-assets",
  filenameFormat: "both",
  autoCreateAssetsDir: true,
  fixedDirectoryPath: "",
};

export const DEFAULT_WORD_COUNT_SETTINGS: WordCountSettings = {
  includeSymbols: false,
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  showArrows: false,
  textOpacity: 50,
  nodeSize: 50,
  linkThickness: 50,
  animate: true,
  /** Obsidian-like: moderate center, strong repel, weak link, longer distance. */
  centerForce: 45,
  repulsion: 75,
  linkForce: 20,
  linkDistance: 70,
  colorGroups: [],
};

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "system",
  fontSize: 16,
  codeFontSize: 14,
  editorWidth: EDITOR_WIDTH_DEFAULT,
  appearance: "light",
  editorFont: "system",
  codeFont: "code",
  uiFont: "system",
  lineHeight: 1.8,
  paragraphSpacing: 1.05,
  codeLineHeight: 1.5,
  codeIndentSize: CODE_INDENT_SIZE_DEFAULT,
  typewriterMode: false,
  focusMode: false,
  firstLineIndentMarkdown: false,
  firstLineIndentPlaintext: true,
  autoHideStatusbar: false,
  autoHideTitlebar: false,
  pinGraphViewInTitlebar: false,
  autoSave: false,
  autoSaveDelayMs: AUTO_SAVE_DELAY_MS_DEFAULT,
  linkUpdateOnMove: "ask",
  wikiLinkPreviewTrigger: "modifier",
  markdownFormat: { ...DEFAULT_MARKDOWN_FORMAT },
  menuDensity: "normal",
  autoHideLibraryBar: false,
  leftSidebarTabs: [...DEFAULT_LEFT_SIDEBAR_TABS],
  rightSidebarTabs: [...DEFAULT_RIGHT_SIDEBAR_TABS],
  showFileTreeIcons: false,
  glassEffect: false,
  image: { ...DEFAULT_IMAGE_SETTINGS },
  graph: { ...DEFAULT_GRAPH_SETTINGS },
  wordCount: { ...DEFAULT_WORD_COUNT_SETTINGS },
  useSystemProxyForUpdates: true,
  showDevSection: false,
};

const EDITOR_WIDTH_LEGACY: Record<string, number> = {
  narrow: 576,
  medium: EDITOR_WIDTH_DEFAULT,
  wide: 960,
  full: EDITOR_WIDTH_MAX,
};

const DENSITY_VARS: Record<
  MenuDensity,
  { controlHeight: string; controlPaddingX: string; menuItemPaddingY: string; treeItemPaddingY: string }
> = {
  compact: {
    controlHeight: "28px",
    controlPaddingX: "6px",
    menuItemPaddingY: "2px",
    treeItemPaddingY: "3px",
  },
  normal: {
    controlHeight: "32px",
    controlPaddingX: "8px",
    menuItemPaddingY: "4px",
    treeItemPaddingY: "5px",
  },
  comfortable: {
    controlHeight: "36px",
    controlPaddingX: "10px",
    menuItemPaddingY: "6px",
    treeItemPaddingY: "7px",
  },
};

/** Created after `normalizeSettings` / `DEFAULT_SETTINGS` — see bottom of module. */
let settingsStore: JsonSettingsStore<AppSettings>;

export function loadSettings(): AppSettings {
  return settingsStore.load();
}

export function saveSettings(settings: AppSettings): void {
  settingsStore.save(settings);
}

export function getSettingsEmitterId(): string {
  return settingsStore.getEmitterId();
}

export function parseSettingsSyncPayload(
  payload: unknown,
): SettingsSyncPayload | null {
  if (!payload || typeof payload !== "object") return null;
  if ("emitterId" in payload && "settings" in payload) {
    return settingsStore.parseSyncPayload(payload);
  }
  if ("fontSize" in payload) {
    return settingsStore.parseSyncPayload(payload);
  }
  return null;
}

export function isExternalSettingsSync(payload: SettingsSyncPayload): boolean {
  return settingsStore.isExternalSync(payload);
}

export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  applyEditorTypographyCss(
    root,
    {
      editorFont: settings.editorFont,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      paragraphSpacing: settings.paragraphSpacing,
      editorWidth: settings.editorWidth,
      firstLineIndent: 0,
    },
    "editor",
  );
  root.style.setProperty("--font-mono-size", `${settings.codeFontSize}px`);
  root.style.setProperty("--font-mono", resolveFontValue(settings.codeFont, "code"));
  root.style.setProperty("--font-ui", resolveFontValue(settings.uiFont, "system"));
  root.style.setProperty("--code-line-height", String(settings.codeLineHeight));

  const density = DENSITY_VARS[settings.menuDensity];
  root.style.setProperty("--control-height", density.controlHeight);
  root.style.setProperty("--control-padding-x", density.controlPaddingX);
  root.style.setProperty("--menu-item-padding-y", density.menuItemPaddingY);
  root.style.setProperty("--tree-item-padding-y", density.treeItemPaddingY);

  root.dataset.typewriter = settings.typewriterMode ? "true" : "false";
  root.dataset.focusMode = settings.focusMode ? "true" : "false";
  root.dataset.firstLineIndentMd = settings.firstLineIndentMarkdown ? "true" : "false";
  root.dataset.firstLineIndentTxt = settings.firstLineIndentPlaintext ? "true" : "false";
  root.dataset.autoHideStatusbar = settings.autoHideStatusbar ? "true" : "false";
  root.dataset.autoHideTitlebar = settings.autoHideTitlebar ? "true" : "false";
  root.dataset.autoHideLibraryBar = settings.autoHideLibraryBar ? "true" : "false";
  root.dataset.menuDensity = settings.menuDensity;
  root.dataset.glass = settings.glassEffect ? "true" : "false";

  const resolved: LocaleId =
    settings.locale === "system" ? detectSystemLocale() : settings.locale;
  setLocale(resolved);
}

export function resolveAppearance(mode: AppearanceMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function menuDensityLabel(density: MenuDensity): string {
  switch (density) {
    case "compact":
      return t("settings.density.compact");
    case "normal":
      return t("settings.density.normal");
    case "comfortable":
      return t("settings.density.comfortable");
  }
}

export function fontPresetOptions(
  ids: FontPresetId[],
): Array<{ value: string; label: string }> {
  return ids.map((id) => ({ value: id, label: FONT_PRESETS[id].label }));
}

function normalizeSettings(parsed: Partial<AppSettings>): AppSettings {
  const format = {
    ...DEFAULT_MARKDOWN_FORMAT,
    ...(parsed.markdownFormat ?? {}),
  };
  const image = {
    ...DEFAULT_IMAGE_SETTINGS,
    ...(parsed.image ?? {}),
  };
  const graph = {
    ...DEFAULT_GRAPH_SETTINGS,
    ...(parsed.graph ?? {}),
  };
  const wordCount = {
    ...DEFAULT_WORD_COUNT_SETTINGS,
    ...(parsed.wordCount ?? {}),
  };
  const tabLayout = normalizeSidebarTabLayout(
    parsed.leftSidebarTabs,
    parsed.rightSidebarTabs,
  );
  return {
    locale: isAppLocale(parsed.locale) ? parsed.locale : DEFAULT_SETTINGS.locale,
    fontSize: clamp(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX),
    codeFontSize: clamp(
      parsed.codeFontSize ?? DEFAULT_SETTINGS.codeFontSize,
      FONT_SIZE_MIN,
      FONT_SIZE_MAX,
    ),
    editorWidth: normalizeEditorWidth(parsed.editorWidth),
    appearance: isAppearance(parsed.appearance)
      ? parsed.appearance
      : DEFAULT_SETTINGS.appearance,
    editorFont: isValidFontSetting(parsed.editorFont)
      ? normalizeFontValue(parsed.editorFont, "system")
      : DEFAULT_SETTINGS.editorFont,
    codeFont: isValidFontSetting(parsed.codeFont)
      ? normalizeFontValue(parsed.codeFont, "code")
      : DEFAULT_SETTINGS.codeFont,
    uiFont: isValidFontSetting(parsed.uiFont)
      ? normalizeFontValue(parsed.uiFont, "system")
      : DEFAULT_SETTINGS.uiFont,
    lineHeight: clampFloat(parsed.lineHeight ?? DEFAULT_SETTINGS.lineHeight, 1.2, 2.8),
    paragraphSpacing: clampFloat(
      parsed.paragraphSpacing ?? DEFAULT_SETTINGS.paragraphSpacing,
      0,
      2,
    ),
    codeLineHeight: clampFloat(
      parsed.codeLineHeight ?? DEFAULT_SETTINGS.codeLineHeight,
      1.1,
      2.4,
    ),
    codeIndentSize: clamp(
      parsed.codeIndentSize ?? DEFAULT_SETTINGS.codeIndentSize,
      CODE_INDENT_SIZE_MIN,
      CODE_INDENT_SIZE_MAX,
    ),
    typewriterMode: Boolean(parsed.typewriterMode ?? DEFAULT_SETTINGS.typewriterMode),
    focusMode: Boolean(parsed.focusMode ?? DEFAULT_SETTINGS.focusMode),
    firstLineIndentMarkdown: Boolean(
      "firstLineIndentMarkdown" in parsed
        ? parsed.firstLineIndentMarkdown
        : ((parsed as { firstLineIndent?: boolean }).firstLineIndent ??
          DEFAULT_SETTINGS.firstLineIndentMarkdown),
    ),
    firstLineIndentPlaintext: Boolean(
      parsed.firstLineIndentPlaintext ?? DEFAULT_SETTINGS.firstLineIndentPlaintext,
    ),
    autoHideStatusbar: Boolean(
      parsed.autoHideStatusbar ??
        (parsed as { immersiveEditing?: boolean }).immersiveEditing ??
        DEFAULT_SETTINGS.autoHideStatusbar,
    ),
    autoHideTitlebar: Boolean(
      parsed.autoHideTitlebar ?? DEFAULT_SETTINGS.autoHideTitlebar,
    ),
    pinGraphViewInTitlebar: Boolean(
      parsed.pinGraphViewInTitlebar ?? DEFAULT_SETTINGS.pinGraphViewInTitlebar,
    ),
    autoSave: Boolean(parsed.autoSave ?? DEFAULT_SETTINGS.autoSave),
    autoSaveDelayMs: normalizeAutoSaveDelayMs(parsed.autoSaveDelayMs),
    linkUpdateOnMove: isLinkUpdateMode(parsed.linkUpdateOnMove)
      ? parsed.linkUpdateOnMove
      : DEFAULT_SETTINGS.linkUpdateOnMove,
    wikiLinkPreviewTrigger: isWikiLinkPreviewTrigger(parsed.wikiLinkPreviewTrigger)
      ? parsed.wikiLinkPreviewTrigger
      : DEFAULT_SETTINGS.wikiLinkPreviewTrigger,
    markdownFormat: {
      formatOnSave: Boolean(format.formatOnSave),
      cjkSpacing: Boolean(format.cjkSpacing),
      trimTrailingWhitespace: Boolean(format.trimTrailingWhitespace),
      ensureFinalNewline: Boolean(format.ensureFinalNewline),
      normalizeBlankLines: Boolean(format.normalizeBlankLines),
    },
    menuDensity: isMenuDensity(parsed.menuDensity)
      ? parsed.menuDensity
      : DEFAULT_SETTINGS.menuDensity,
    autoHideLibraryBar: Boolean(
      parsed.autoHideLibraryBar ?? DEFAULT_SETTINGS.autoHideLibraryBar,
    ),
    leftSidebarTabs: tabLayout.left,
    rightSidebarTabs: tabLayout.right,
    showFileTreeIcons: Boolean(
      parsed.showFileTreeIcons ?? DEFAULT_SETTINGS.showFileTreeIcons,
    ),
    glassEffect: Boolean(parsed.glassEffect ?? DEFAULT_SETTINGS.glassEffect),
    image: {
      storageMode: isImageStorageMode(image.storageMode)
        ? image.storageMode
        : DEFAULT_IMAGE_SETTINGS.storageMode,
      filenameFormat: isImageFilenameFormat(image.filenameFormat)
        ? image.filenameFormat
        : DEFAULT_IMAGE_SETTINGS.filenameFormat,
      autoCreateAssetsDir: Boolean(image.autoCreateAssetsDir),
      fixedDirectoryPath:
        typeof image.fixedDirectoryPath === "string" ? image.fixedDirectoryPath : "",
    },
    graph: normalizeGraphSettings(graph),
    wordCount: {
      includeSymbols: Boolean(wordCount.includeSymbols),
    },
    useSystemProxyForUpdates: Boolean(
      parsed.useSystemProxyForUpdates ?? DEFAULT_SETTINGS.useSystemProxyForUpdates,
    ),
    showDevSection: Boolean(parsed.showDevSection ?? DEFAULT_SETTINGS.showDevSection),
  };
}

function normalizeColorGroups(
  raw: unknown,
): GraphColorGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: GraphColorGroup[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.id === "string" && rec.id.trim()
        ? rec.id.trim()
        : `group-${i}`;
    const colorRaw = typeof rec.color === "string" ? rec.color.trim() : "";
    const color = isUsableGraphColor(colorRaw) ? colorRaw : paletteColorAt(i);
    const enabled = rec.enabled === undefined ? true : Boolean(rec.enabled);
    const rule = normalizeColorGroupRule(rec);
    groups.push({ id, color, enabled, ...rule });
  }
  return groups;
}

function normalizeGraphSettings(graph: Partial<GraphSettings>): GraphSettings {
  return {
    showArrows: Boolean(graph.showArrows ?? DEFAULT_GRAPH_SETTINGS.showArrows),
    textOpacity: clamp(graph.textOpacity ?? DEFAULT_GRAPH_SETTINGS.textOpacity, 0, 100),
    nodeSize: clamp(graph.nodeSize ?? DEFAULT_GRAPH_SETTINGS.nodeSize, 0, 100),
    linkThickness: clamp(
      graph.linkThickness ?? DEFAULT_GRAPH_SETTINGS.linkThickness,
      0,
      100,
    ),
    animate: Boolean(graph.animate ?? DEFAULT_GRAPH_SETTINGS.animate),
    centerForce: clamp(graph.centerForce ?? DEFAULT_GRAPH_SETTINGS.centerForce, 0, 100),
    repulsion: clamp(graph.repulsion ?? DEFAULT_GRAPH_SETTINGS.repulsion, 0, 100),
    linkForce: clamp(graph.linkForce ?? DEFAULT_GRAPH_SETTINGS.linkForce, 0, 100),
    linkDistance: clamp(
      graph.linkDistance ?? DEFAULT_GRAPH_SETTINGS.linkDistance,
      0,
      100,
    ),
    colorGroups: normalizeColorGroups(
      graph.colorGroups ?? DEFAULT_GRAPH_SETTINGS.colorGroups,
    ),
  };
}

/** Map a 0–100 slider to a force/draw multiplier (50 → 1). */
export function graphSettingFactor(value: number): number {
  return Math.max(0.05, value / 50);
}

type GraphSettingsListener = (graph: GraphSettings) => void;
const graphSettingsListeners = new Set<GraphSettingsListener>();

/** Same-window subscribers (editor float ↔ sidebar graph). Cross-window uses `storage`. */
export function subscribeGraphSettings(listener: GraphSettingsListener): () => void {
  graphSettingsListeners.add(listener);
  return () => {
    graphSettingsListeners.delete(listener);
  };
}

export function patchGraphSettings(partial: Partial<GraphSettings>): GraphSettings {
  const settings = loadSettings();
  const graph = normalizeGraphSettings({ ...settings.graph, ...partial });
  saveSettings({ ...settings, graph });
  for (const listener of graphSettingsListeners) {
    listener(graph);
  }
  return graph;
}

export function normalizeAutoSaveDelayMs(ms: number | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return AUTO_SAVE_DELAY_MS_DEFAULT;
  return Math.min(
    AUTO_SAVE_DELAY_MS_MAX,
    Math.max(AUTO_SAVE_DELAY_MS_MIN, Math.round(ms)),
  );
}

export function autoSaveDelayFromParts(
  value: number,
  unit: AutoSaveDelayUnit,
): number {
  const mult = unit === "h" ? 3_600_000 : unit === "min" ? 60_000 : 1_000;
  return value * mult;
}

export function autoSaveDelayToParts(ms: number): {
  value: number;
  unit: AutoSaveDelayUnit;
} {
  const normalized = normalizeAutoSaveDelayMs(ms);
  const hours = normalized / 3_600_000;
  if (hours >= 1 && Math.abs(hours - Math.round(hours)) < 1e-9) {
    return { value: Math.round(hours), unit: "h" };
  }
  const minutes = normalized / 60_000;
  if (minutes >= 1 && Math.abs(minutes - Math.round(minutes)) < 1e-9) {
    return { value: Math.round(minutes), unit: "min" };
  }
  return { value: normalized / 1_000, unit: "s" };
}

export function formatAutoSaveDelayValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(parseFloat(value.toFixed(3)));
}

export function parseAutoSaveDelayInput(
  raw: string,
  unit: AutoSaveDelayUnit,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  const ms = Math.round(autoSaveDelayFromParts(value, unit));
  if (ms < AUTO_SAVE_DELAY_MS_MIN || ms > AUTO_SAVE_DELAY_MS_MAX) return null;
  return ms;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}

function normalizeEditorWidth(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(value, EDITOR_WIDTH_MIN, EDITOR_WIDTH_MAX);
  }
  if (typeof value === "string" && value in EDITOR_WIDTH_LEGACY) {
    return EDITOR_WIDTH_LEGACY[value]!;
  }
  return DEFAULT_SETTINGS.editorWidth;
}

function isAppearance(value: unknown): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "zh-CN" || value === "system";
}

function isMenuDensity(value: unknown): value is MenuDensity {
  return value === "compact" || value === "normal" || value === "comfortable";
}

function isLinkUpdateMode(value: unknown): value is LinkUpdateMode {
  return value === "ask" || value === "always" || value === "never";
}

function isWikiLinkPreviewTrigger(value: unknown): value is WikiLinkPreviewTrigger {
  return value === "modifier" || value === "hover";
}

function isImageStorageMode(value: unknown): value is ImageStorageMode {
  return value === "library-assets" || value === "fixed-directory";
}

function isImageFilenameFormat(value: unknown): value is ImageFilenameFormat {
  return value === "original" || value === "timestamp" || value === "both";
}

settingsStore = createJsonSettingsStore<AppSettings>({
  key: SETTINGS_STORAGE_KEY,
  syncEvent: SETTINGS_SYNC_EVENT,
  defaults: DEFAULT_SETTINGS,
  normalize: (raw) =>
    normalizeSettings(
      raw && typeof raw === "object" ? (raw as Partial<AppSettings>) : {},
    ),
});
