/**
 * Re-export shared system-font helpers. Prefer importing from `@dionysen/shell`
 * in new code; this path remains for existing Inimark imports.
 */
export {
  listSystemFonts,
  type SystemFontInfo,
} from "@dionysen/shell";

export {
  FONT_PRESETS,
  SYSTEM_FONT_SENTINEL,
  quoteFontFamily,
  isFontStack,
  resolveFontValue,
  normalizeFontValue,
  isValidFontSetting,
  type FontPresetId,
} from "@dionysen/ui";
