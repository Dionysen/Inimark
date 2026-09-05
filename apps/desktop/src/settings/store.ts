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

export type EditorWidth = "narrow" | "medium" | "wide" | "full";
export type AppearanceMode = "light" | "dark" | "system";
export type MenuDensity = "compact" | "normal" | "comfortable";
export type ImageStorageMode = "library-assets" | "fixed-directory";
export type ImageFilenameFormat = "original" | "timestamp" | "both";
export type AppLocale = "en" | "zh-CN" | "system";

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

export interface AppSettings {
  /** UI language. `system` follows OS locale. */
  locale: AppLocale;
  fontSize: number;
  codeFontSize: number;
  editorWidth: EditorWidth;
  appearance: AppearanceMode;
  editorFont: string;
  codeFont: string;
  uiFont: string;
  lineHeight: number;
  paragraphSpacing: number;
  codeLineHeight: number;
  typewriterMode: boolean;
  autoSave: boolean;
  markdownFormat: MarkdownFormatSettings;
  menuDensity: MenuDensity;
  autoHideLibraryBar: boolean;
  /** Frosted glass for menus. Floating library chrome is always frosted. */
  glassEffect: boolean;
  image: ImageSettings;
}

export const SETTINGS_STORAGE_KEY = "inimark:settings";

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

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "system",
  fontSize: 16,
  codeFontSize: 14,
  editorWidth: "medium",
  appearance: "light",
  editorFont: "system",
  codeFont: "code",
  uiFont: "system",
  lineHeight: 1.8,
  paragraphSpacing: 1.05,
  codeLineHeight: 1.5,
  typewriterMode: false,
  autoSave: false,
  markdownFormat: { ...DEFAULT_MARKDOWN_FORMAT },
  menuDensity: "normal",
  autoHideLibraryBar: false,
  glassEffect: false,
  image: { ...DEFAULT_IMAGE_SETTINGS },
};

const EDITOR_WIDTHS: Record<EditorWidth, string> = {
  narrow: "36rem",
  medium: "48rem",
  wide: "60rem",
  full: "100%",
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

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return normalizeSettings(parsed);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;
  root.style.setProperty("--inimark-editor-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--font-mono-size", `${settings.codeFontSize}px`);
  root.style.setProperty(
    "--inimark-editor-max-width",
    EDITOR_WIDTHS[settings.editorWidth],
  );
  root.style.setProperty("--editor-font", resolveFontValue(settings.editorFont, "system"));
  root.style.setProperty("--font-mono", resolveFontValue(settings.codeFont, "code"));
  root.style.setProperty("--font-ui", resolveFontValue(settings.uiFont, "system"));
  root.style.setProperty("--editor-line-height", String(settings.lineHeight));
  root.style.setProperty("--editor-paragraph-spacing", `${settings.paragraphSpacing}em`);
  root.style.setProperty("--code-line-height", String(settings.codeLineHeight));

  const density = DENSITY_VARS[settings.menuDensity];
  root.style.setProperty("--control-height", density.controlHeight);
  root.style.setProperty("--control-padding-x", density.controlPaddingX);
  root.style.setProperty("--menu-item-padding-y", density.menuItemPaddingY);
  root.style.setProperty("--tree-item-padding-y", density.treeItemPaddingY);

  root.dataset.typewriter = settings.typewriterMode ? "true" : "false";
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

export function editorWidthLabel(width: EditorWidth): string {
  switch (width) {
    case "narrow":
      return t("settings.width.narrow");
    case "medium":
      return t("settings.width.medium");
    case "wide":
      return t("settings.width.wide");
    case "full":
      return t("settings.width.full");
  }
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
  return {
    locale: isAppLocale(parsed.locale) ? parsed.locale : DEFAULT_SETTINGS.locale,
    fontSize: clamp(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize, 10, 24),
    codeFontSize: clamp(parsed.codeFontSize ?? DEFAULT_SETTINGS.codeFontSize, 10, 24),
    editorWidth: isEditorWidth(parsed.editorWidth)
      ? parsed.editorWidth
      : DEFAULT_SETTINGS.editorWidth,
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
    typewriterMode: Boolean(parsed.typewriterMode ?? DEFAULT_SETTINGS.typewriterMode),
    autoSave: Boolean(parsed.autoSave ?? DEFAULT_SETTINGS.autoSave),
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
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}

function isEditorWidth(value: unknown): value is EditorWidth {
  return value === "narrow" || value === "medium" || value === "wide" || value === "full";
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

function isImageStorageMode(value: unknown): value is ImageStorageMode {
  return value === "library-assets" || value === "fixed-directory";
}

function isImageFilenameFormat(value: unknown): value is ImageFilenameFormat {
  return value === "original" || value === "timestamp" || value === "both";
}
