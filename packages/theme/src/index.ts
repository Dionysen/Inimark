export {
  configureTheme,
  getThemeConfig,
  tryGetThemeConfig,
  themeT,
  type ThemeProductConfig,
  type ThemeEditorProfile,
} from "./config.ts";

export {
  BUILTIN_THEMES,
  DEFAULT_DARK_BUILTIN,
  isBuiltinTheme,
  isCustomTheme,
  getThemeIdFromCustom,
  normalizeAppThemeId,
  type BuiltinThemeName,
} from "./builtin.ts";

export {
  type AppearanceMode,
  type ResolvedAppearance,
  type ThemePair,
  type AppearanceState,
  DEFAULT_APP_THEME_PAIR,
  BUILTIN_THEME_IS_DARK,
  APPEARANCE_MODE_KEY,
  PREFERRED_APP_THEME_KEY,
  LEGACY_THEME_KEY,
  APPEARANCE_SYNC_EVENT,
  THEME_CATALOG_SYNC_EVENT,
  getSystemIsDark,
  resolveAppearanceMode,
  resolveActiveFromPair,
  isBuiltinAppThemeDark,
  inferThemeIdIsDark,
  loadAppearanceState,
  persistAppearanceState,
  withPreferredApp,
} from "./appearance.ts";

export {
  type ThemeManifest,
  type ThemeVariable,
  type ThemePreviewColors,
  loadManifest,
  saveManifest,
  parseCssVariables,
  convertSelectorsToDataTheme,
  buildThemeCss,
  importTheme,
  deleteTheme,
  getCustomThemeCss,
  saveThemeCss,
  createThemeFromVariables,
  renameTheme,
  persistThemeVariables,
  extractPreviewColors,
  resolveThemePreviewColors,
  inferAppThemeIsDark,
} from "./theme-store.ts";

export {
  type ThemeEditorSectionId,
  type ThemeColorGroup,
  type ThemeColorToken,
  type ThemeSizeToken,
  type ThemeToggleToken,
  type ThemeEditorSectionDef,
  type ThemeEditorField,
  type ThemeEditorSectionView,
  THEME_EDITOR_SECTIONS,
  THEME_COLOR_GROUPS,
  THEME_COLOR_SCHEMA,
  THEME_SIZE_SCHEMA,
  THEME_TOGGLE_SCHEMA,
  CHROME_EDITOR_SECTIONS,
  isChromeEditorSection,
  filterEditorSectionsByProfile,
  getBuiltinColorMap,
  getBuiltinThemeVariables,
  getTemplateVariables,
  mergeWithSchema,
  getEditableSizeVariables,
  getSizeTokenMeta,
  getToggleTokenMeta,
  getEditableColorVariables,
  buildThemeEditorSections,
  groupEditableColors,
  getTokenMeta,
} from "./theme-tokens.ts";

export {
  THEME_PACK_FORMAT,
  THEME_PACK_VERSION,
  type ThemePackThemeEntry,
  type ThemePack,
  type ThemePackAppImportResult,
  recordToVariables,
  allocateUniqueThemeName,
  exportCustomAppTheme,
  buildThemePack,
  parseThemePack,
  importSelectedAppThemes,
  exportThemePackToFile,
  pickAndReadThemePackFile,
  slotToRootCss,
  getPackFormat,
} from "./theme-pack.ts";

export {
  type ThemeName,
  type AppThemeManagerSnapshot,
  type AppThemeManager,
  getThemeManager,
  initThemeManager,
  resetThemeManagerForTests,
} from "./manager.ts";

export { themeLabel, themeTokenDesc, builtinThemeLabel } from "./labels.ts";

export {
  type RgbaColor,
  type HsvaColor,
  clamp,
  normalizeColorToHex,
  parseColor,
  formatColor,
  rgbaToHsva,
  hsvaToRgba,
  colorToRgbChannels,
  syncAccentRgb,
  supportsEyeDropper,
  pickColorWithEyeDropper,
  applyCheckerboard,
  applyCheckerboardUnder,
  checkerboardCss,
} from "./color-utils.ts";

export { createThemeColorField, type ThemeColorFieldOptions } from "./color-field.ts";
export { createThemeSizeField, type ThemeSizeFieldOptions } from "./size-field.ts";
export { createThemeToggleField, type ThemeToggleFieldOptions } from "./toggle-field.ts";

export { renderChromeThemePanel, getThemeSlotSelection } from "./chrome-panel.ts";
