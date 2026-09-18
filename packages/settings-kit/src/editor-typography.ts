import {
  normalizeFontValue,
  resolveFontValue,
  isValidFontSetting,
} from "@dionysen/ui/font-catalog";

/** CJK ideographic space used for content first-line indent. */
export const IDEOGRAPHIC_SPACE = "\u3000";

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 36;
export const FONT_SIZE_DEFAULT = 16;

export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.8;
export const LINE_HEIGHT_DEFAULT = 1.6;
export const LINE_HEIGHT_STEP = 0.1;

export const PARAGRAPH_SPACING_MIN = 0;
export const PARAGRAPH_SPACING_MAX = 2;
export const PARAGRAPH_SPACING_DEFAULT = 1.05;
export const PARAGRAPH_SPACING_STEP = 0.1;

/** Readable minimum measure for a writing column. */
export const EDITOR_WIDTH_MIN = 320;
export const EDITOR_WIDTH_DEFAULT = 720;

export const FIRST_LINE_INDENT_MIN = 0;
export const FIRST_LINE_INDENT_MAX = 4;
export const FIRST_LINE_INDENT_DEFAULT = 2;

/** Shared typography fields used by writing shells (Vellum) and editors. */
export interface EditorTypographySettings {
  /** Preset id or system font family name. */
  editorFont: string;
  fontSize: number;
  /** Unitless line-height. */
  lineHeight: number;
  /** Paragraph bottom margin in em. */
  paragraphSpacing: number;
  /** Writing column max-width in px. */
  editorWidth: number;
  /** Number of ideographic spaces (`　`) inserted at new paragraph starts. */
  firstLineIndent: number;
}

export const DEFAULT_EDITOR_TYPOGRAPHY: EditorTypographySettings = {
  editorFont: "system",
  fontSize: FONT_SIZE_DEFAULT,
  lineHeight: LINE_HEIGHT_DEFAULT,
  paragraphSpacing: PARAGRAPH_SPACING_DEFAULT,
  editorWidth: EDITOR_WIDTH_DEFAULT,
  firstLineIndent: FIRST_LINE_INDENT_DEFAULT,
};

export type TypographyCssProfile = "shell" | "editor";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampFloat(n: number, min: number, max: number, step = 0.1): number {
  const rounded = Math.round(n / step) * step;
  return clamp(Number(rounded.toFixed(10)), min, max);
}

/** Build the ideographic-space prefix for a new paragraph (empty when count is 0). */
export function firstLineIndentPrefix(count: number): string {
  const n = clamp(
    Math.round(count),
    FIRST_LINE_INDENT_MIN,
    FIRST_LINE_INDENT_MAX,
  );
  return IDEOGRAPHIC_SPACE.repeat(n);
}

/**
 * Normalize typography fields from a raw settings object.
 * `editorWidthMax` clamps width against the current window ceiling when provided.
 */
export function normalizeEditorTypography(
  raw: Record<string, unknown>,
  options: {
    defaults?: Partial<EditorTypographySettings>;
    editorWidthMax?: number;
    fontSizeMin?: number;
    fontSizeMax?: number;
  } = {},
): EditorTypographySettings {
  const defaults = { ...DEFAULT_EDITOR_TYPOGRAPHY, ...options.defaults };
  const fontSizeMin = options.fontSizeMin ?? FONT_SIZE_MIN;
  const fontSizeMax = options.fontSizeMax ?? FONT_SIZE_MAX;
  const widthMax = Math.max(
    EDITOR_WIDTH_MIN,
    options.editorWidthMax ?? 10_000,
  );

  const editorFont = isValidFontSetting(raw.editorFont)
    ? normalizeFontValue(raw.editorFont, "system")
    : defaults.editorFont;

  const fontSize = clamp(
    typeof raw.fontSize === "number" ? raw.fontSize : defaults.fontSize,
    fontSizeMin,
    fontSizeMax,
  );

  const lineHeight = clampFloat(
    typeof raw.lineHeight === "number" ? raw.lineHeight : defaults.lineHeight,
    LINE_HEIGHT_MIN,
    LINE_HEIGHT_MAX,
    LINE_HEIGHT_STEP,
  );

  const paragraphSpacing = clampFloat(
    typeof raw.paragraphSpacing === "number"
      ? raw.paragraphSpacing
      : defaults.paragraphSpacing,
    PARAGRAPH_SPACING_MIN,
    PARAGRAPH_SPACING_MAX,
    PARAGRAPH_SPACING_STEP,
  );

  const editorWidth = clamp(
    typeof raw.editorWidth === "number" ? raw.editorWidth : defaults.editorWidth,
    EDITOR_WIDTH_MIN,
    widthMax,
  );

  const firstLineIndent = clamp(
    Math.round(
      typeof raw.firstLineIndent === "number"
        ? raw.firstLineIndent
        : defaults.firstLineIndent,
    ),
    FIRST_LINE_INDENT_MIN,
    FIRST_LINE_INDENT_MAX,
  );

  return {
    editorFont,
    fontSize,
    lineHeight,
    paragraphSpacing,
    editorWidth,
    firstLineIndent,
  };
}

/**
 * Map typography settings onto CSS variables / datasets on `root`.
 *
 * - `shell`: `--shell-editor-*` (Vellum / shared chrome tokens)
 * - `editor`: `--editor-*` + `--inimark-editor-*` (Inimark / @inimark/editor)
 */
export function applyEditorTypographyCss(
  root: HTMLElement,
  settings: EditorTypographySettings,
  profile: TypographyCssProfile = "shell",
): void {
  const fontCss = resolveFontValue(settings.editorFont, "system");
  const size = `${settings.fontSize}px`;
  const width = `${settings.editorWidth}px`;
  const spacing = `${settings.paragraphSpacing}em`;

  if (profile === "shell") {
    root.style.setProperty("--shell-editor-font", fontCss);
    root.style.setProperty("--shell-editor-font-size", size);
    root.style.setProperty("--shell-editor-line-height", String(settings.lineHeight));
    root.style.setProperty("--shell-editor-paragraph-spacing", spacing);
    root.style.setProperty("--shell-editor-max-width", width);
    root.dataset.firstLineIndent = String(settings.firstLineIndent);
  } else {
    root.style.setProperty("--editor-font", fontCss);
    root.style.setProperty("--editor-font-size", size);
    root.style.setProperty("--inimark-editor-font-size", size);
    root.style.setProperty("--editor-line-height", String(settings.lineHeight));
    root.style.setProperty("--editor-paragraph-spacing", spacing);
    root.style.setProperty("--inimark-editor-max-width", width);
  }
}

/** Read first-line indent count from a root previously updated by `applyEditorTypographyCss`. */
export function readFirstLineIndent(root: HTMLElement = document.documentElement): number {
  const raw = root.dataset.firstLineIndent;
  const n = raw == null ? FIRST_LINE_INDENT_DEFAULT : Number(raw);
  if (!Number.isFinite(n)) return FIRST_LINE_INDENT_DEFAULT;
  return clamp(Math.round(n), FIRST_LINE_INDENT_MIN, FIRST_LINE_INDENT_MAX);
}
