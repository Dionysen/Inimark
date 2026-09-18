import {
  createFontPicker,
  createSlider,
  type FontPresetId,
  type FontPickerController,
  type SystemFontInfo,
} from "@dionysen/ui";
import { createRow } from "./row.ts";
import {
  EDITOR_WIDTH_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FIRST_LINE_INDENT_MAX,
  FIRST_LINE_INDENT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  PARAGRAPH_SPACING_MAX,
  PARAGRAPH_SPACING_MIN,
  PARAGRAPH_SPACING_STEP,
  type EditorTypographySettings,
} from "./editor-typography.ts";

export interface EditorTypographyLabels {
  editorFont: string;
  editorFontDesc: string;
  fontSize: string;
  fontSizeDesc: string;
  lineHeight: string;
  lineHeightDesc: string;
  paragraphSpacing: string;
  paragraphSpacingDesc: string;
  editorWidth: string;
  editorWidthDesc: string;
  firstLineIndent: string;
  firstLineIndentDesc: string;
  firstLineIndentValue: (n: number) => string;
}

export interface AppendEditorTypographyOptions {
  body: HTMLElement;
  settings: EditorTypographySettings;
  labels: EditorTypographyLabels;
  /** Upper bound for the width slider (current window available width). */
  editorWidthMax: number;
  /** Host-provided system font listing (typically `@dionysen/shell` `listSystemFonts`). */
  listSystemFonts?: (force?: boolean) => Promise<SystemFontInfo[]>;
  fontPresets?: FontPresetId[];
  fontSizeMin?: number;
  fontSizeMax?: number;
  onPatch: (partial: Partial<EditorTypographySettings>) => void;
  /** Fired while dragging (optional live preview). Defaults to `onPatch`. */
  onLivePatch?: (partial: Partial<EditorTypographySettings>) => void;
  idPrefix?: string;
}

export interface EditorTypographyControls {
  destroy(): void;
  /** Update width slider max when the host window size changes. */
  setEditorWidthMax(max: number): void;
}

const DEFAULT_PRESETS: FontPresetId[] = ["serif", "rounded", "mono"];

/**
 * Append shared typography rows (font, size, leading, spacing, width, indent).
 * Returns a controller so hosts can tear down pickers and refresh width max.
 */
export function appendEditorTypographyControls(
  options: AppendEditorTypographyOptions,
): EditorTypographyControls {
  const {
    body,
    settings,
    labels,
    onPatch,
    listSystemFonts,
    fontPresets = DEFAULT_PRESETS,
    fontSizeMin = FONT_SIZE_MIN,
    fontSizeMax = FONT_SIZE_MAX,
    idPrefix = "editor",
  } = options;
  const live = options.onLivePatch ?? onPatch;
  let widthMax = Math.max(EDITOR_WIDTH_MIN, Math.floor(options.editorWidthMax));

  const disposers: Array<() => void> = [];
  const track = <T extends { destroy(): void }>(c: T): T => {
    disposers.push(() => c.destroy());
    return c;
  };

  const font: FontPickerController = track(
    createFontPicker({
      mode: "editor",
      value: settings.editorFont,
      presets: fontPresets,
      minWidth: 180,
      listSystemFonts,
      onChange: (value) => onPatch({ editorFont: value }),
    }),
  );
  body.append(
    createRow(
      labels.editorFont,
      labels.editorFontDesc,
      font.el,
      `${idPrefix}.editorFont`,
    ),
  );

  const fontSize = track(
    createSlider({
      min: fontSizeMin,
      max: fontSizeMax,
      step: 1,
      value: settings.fontSize,
      formatValue: (v) => `${v}px`,
      onInput: (value) => live({ fontSize: value }),
      onChange: (value) => onPatch({ fontSize: value }),
    }),
  );
  body.append(
    createRow(
      labels.fontSize,
      labels.fontSizeDesc,
      fontSize.el,
      `${idPrefix}.fontSize`,
    ),
  );

  const lineHeight = track(
    createSlider({
      min: LINE_HEIGHT_MIN,
      max: LINE_HEIGHT_MAX,
      step: LINE_HEIGHT_STEP,
      value: settings.lineHeight,
      formatValue: (v) => v.toFixed(1),
      onInput: (value) => live({ lineHeight: value }),
      onChange: (value) => onPatch({ lineHeight: value }),
    }),
  );
  body.append(
    createRow(
      labels.lineHeight,
      labels.lineHeightDesc,
      lineHeight.el,
      `${idPrefix}.lineHeight`,
    ),
  );

  const paragraphSpacing = track(
    createSlider({
      min: PARAGRAPH_SPACING_MIN,
      max: PARAGRAPH_SPACING_MAX,
      step: PARAGRAPH_SPACING_STEP,
      value: settings.paragraphSpacing,
      formatValue: (v) => v.toFixed(1),
      onInput: (value) => live({ paragraphSpacing: value }),
      onChange: (value) => onPatch({ paragraphSpacing: value }),
    }),
  );
  body.append(
    createRow(
      labels.paragraphSpacing,
      labels.paragraphSpacingDesc,
      paragraphSpacing.el,
      `${idPrefix}.paragraphSpacing`,
    ),
  );

  let widthSlider = createSlider({
    min: EDITOR_WIDTH_MIN,
    max: widthMax,
    step: 1,
    value: Math.min(settings.editorWidth, widthMax),
    formatValue: (v) => `${v}px`,
    onInput: (value) => live({ editorWidth: value }),
    onChange: (value) => onPatch({ editorWidth: value }),
  });
  let destroyWidth = () => widthSlider.destroy();
  disposers.push(() => destroyWidth());
  const widthRow = createRow(
    labels.editorWidth,
    labels.editorWidthDesc,
    widthSlider.el,
    `${idPrefix}.editorWidth`,
  );
  body.append(widthRow);

  const firstLineIndent = track(
    createSlider({
      min: FIRST_LINE_INDENT_MIN,
      max: FIRST_LINE_INDENT_MAX,
      step: 1,
      value: settings.firstLineIndent,
      formatValue: (v) => labels.firstLineIndentValue(v),
      onInput: (value) => live({ firstLineIndent: value }),
      onChange: (value) => onPatch({ firstLineIndent: value }),
    }),
  );
  body.append(
    createRow(
      labels.firstLineIndent,
      labels.firstLineIndentDesc,
      firstLineIndent.el,
      `${idPrefix}.firstLineIndent`,
    ),
  );

  return {
    destroy() {
      for (const d of disposers.splice(0)) d();
    },
    setEditorWidthMax(max: number) {
      const nextMax = Math.max(EDITOR_WIDTH_MIN, Math.floor(max));
      if (nextMax === widthMax) return;
      widthMax = nextMax;
      const current = Math.min(widthSlider.getValue(), widthMax);
      destroyWidth();
      widthSlider = createSlider({
        min: EDITOR_WIDTH_MIN,
        max: widthMax,
        step: 1,
        value: current,
        formatValue: (v) => `${v}px`,
        onInput: (value) => live({ editorWidth: value }),
        onChange: (value) => onPatch({ editorWidth: value }),
      });
      destroyWidth = () => widthSlider.destroy();
      const ctrl = widthRow.querySelector(".inimark-settings-row-control");
      if (ctrl) ctrl.replaceChildren(widthSlider.el);
    },
  };
}
