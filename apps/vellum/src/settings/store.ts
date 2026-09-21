import {
  createJsonSettingsStore,
  applyEditorTypographyCss,
  normalizeEditorTypography,
  EDITOR_WIDTH_DEFAULT,
  EDITOR_WIDTH_MIN,
  FONT_SIZE_DEFAULT,
  FIRST_LINE_INDENT_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  PARAGRAPH_SPACING_DEFAULT,
  type EditorTypographySettings,
} from "@dionysen/settings-kit";
import { setLocale, detectSystemLocale, type LocaleId } from "../i18n/index.ts";

export type AppLocale = LocaleId | "system";

export type { EditorTypographySettings };

export interface WordCountSettings {
  /** true = count punctuation; false = count pure text (letters + numbers) only. */
  includeSymbols: boolean;
}

export interface AppSettings extends EditorTypographySettings {
  locale: AppLocale;
  /** Keep the caret line vertically centered while writing. */
  typewriterMode: boolean;
  /** Hide the bottom-corner status tools until the pointer enters that area. */
  autoHideStatusbar: boolean;
  /** Keep the bottom-right word count visible while corner tools are hidden. */
  alwaysShowWordCount: boolean;
  wordCount: WordCountSettings;
}

export const SETTINGS_STORAGE_KEY = "vellum-settings";
export const SETTINGS_SYNC_EVENT = "vellum:settings-sync";

/** Main window publishes the writing-column client width for the settings slider max. */
export const EDITOR_WIDTH_CEILING_KEY = "vellum-editor-width-ceiling";

/** Vellum keeps a slightly tighter body size range than Inimark. */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 28;
export {
  EDITOR_WIDTH_DEFAULT,
  EDITOR_WIDTH_MIN,
  FONT_SIZE_DEFAULT,
  FIRST_LINE_INDENT_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  PARAGRAPH_SPACING_DEFAULT,
};

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "system",
  editorFont: "system",
  fontSize: FONT_SIZE_DEFAULT,
  lineHeight: LINE_HEIGHT_DEFAULT,
  paragraphSpacing: PARAGRAPH_SPACING_DEFAULT,
  editorWidth: EDITOR_WIDTH_DEFAULT,
  firstLineIndent: FIRST_LINE_INDENT_DEFAULT,
  typewriterMode: false,
  autoHideStatusbar: false,
  alwaysShowWordCount: false,
  wordCount: { includeSymbols: false },
};

/** Read the last published editor-column width ceiling (fallback: viewport). */
export function readEditorWidthCeiling(): number {
  const raw = localStorage.getItem(EDITOR_WIDTH_CEILING_KEY);
  const parsed = raw == null ? NaN : Number(raw);
  if (Number.isFinite(parsed) && parsed >= EDITOR_WIDTH_MIN) {
    return Math.floor(parsed);
  }
  if (typeof window !== "undefined" && window.innerWidth > 0) {
    return Math.max(EDITOR_WIDTH_MIN, Math.floor(window.innerWidth));
  }
  return Math.max(EDITOR_WIDTH_MIN, EDITOR_WIDTH_DEFAULT);
}

/** Publish available writing-column width so the settings slider max stays in sync. */
export function publishEditorWidthCeiling(widthPx: number): void {
  const next = Math.max(EDITOR_WIDTH_MIN, Math.floor(widthPx));
  localStorage.setItem(EDITOR_WIDTH_CEILING_KEY, String(next));
}

export function normalizeSettings(raw: unknown): AppSettings {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const locale =
    src.locale === "en" || src.locale === "zh-CN" || src.locale === "system"
      ? src.locale
      : DEFAULT_SETTINGS.locale;
  const typography = normalizeEditorTypography(src, {
    defaults: DEFAULT_SETTINGS,
    editorWidthMax: readEditorWidthCeiling(),
    fontSizeMin: FONT_SIZE_MIN,
    fontSizeMax: FONT_SIZE_MAX,
  });
  const wordCountSrc =
    src.wordCount && typeof src.wordCount === "object"
      ? (src.wordCount as Record<string, unknown>)
      : {};
  return {
    locale,
    typewriterMode: src.typewriterMode === true,
    autoHideStatusbar: src.autoHideStatusbar === true,
    alwaysShowWordCount: src.alwaysShowWordCount === true,
    wordCount: { includeSymbols: wordCountSrc.includeSymbols === true },
    ...typography,
  };
}

const store = createJsonSettingsStore<AppSettings>({
  key: SETTINGS_STORAGE_KEY,
  syncEvent: SETTINGS_SYNC_EVENT,
  defaults: DEFAULT_SETTINGS,
  normalize: normalizeSettings,
});

export const loadSettings = store.load;
export const saveSettings = store.save;
export const parseSettingsSyncPayload = store.parseSyncPayload;
export const isExternalSettingsSync = store.isExternalSync;
export const subscribeSettings = store.subscribe;

/** Apply chrome side effects for the current settings object. */
export function applySettings(settings: AppSettings): void {
  applyEditorTypographyCss(document.documentElement, settings, "shell");
  document.documentElement.dataset.autoHideStatusbar = settings.autoHideStatusbar
    ? "true"
    : "false";
  document.documentElement.dataset.alwaysShowWordCount = settings.alwaysShowWordCount
    ? "true"
    : "false";
  setLocale(settings.locale === "system" ? detectSystemLocale() : settings.locale);
}

export function patchSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...partial };
  const normalized = normalizeSettings(next);
  saveSettings(normalized);
  applySettings(normalized);
  return normalized;
}
