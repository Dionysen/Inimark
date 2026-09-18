export {
  createJsonSettingsStore,
  type JsonSettingsStore,
  type JsonSettingsStoreOptions,
  type SettingsSyncPayload,
} from "./store.ts";

export {
  createRow,
  createSectionTitle,
} from "./row.ts";

export {
  createCollapsibleGroup,
  type CollapsibleGroup,
  type CollapsibleGroupOptions,
} from "./collapsible-group.ts";

export {
  mountSettingsView,
} from "./view.ts";

export {
  openAuxWindow,
  queueAuxWindowSection,
  type OpenAuxWindowOptions,
} from "./window.ts";

export {
  IDEOGRAPHIC_SPACE,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_DEFAULT,
  LINE_HEIGHT_STEP,
  PARAGRAPH_SPACING_MIN,
  PARAGRAPH_SPACING_MAX,
  PARAGRAPH_SPACING_DEFAULT,
  PARAGRAPH_SPACING_STEP,
  EDITOR_WIDTH_MIN,
  EDITOR_WIDTH_DEFAULT,
  FIRST_LINE_INDENT_MIN,
  FIRST_LINE_INDENT_MAX,
  FIRST_LINE_INDENT_DEFAULT,
  DEFAULT_EDITOR_TYPOGRAPHY,
  firstLineIndentPrefix,
  normalizeEditorTypography,
  applyEditorTypographyCss,
  readFirstLineIndent,
  type EditorTypographySettings,
  type TypographyCssProfile,
} from "./editor-typography.ts";

export {
  appendEditorTypographyControls,
  type AppendEditorTypographyOptions,
  type EditorTypographyControls,
  type EditorTypographyLabels,
} from "./editor-typography-ui.ts";

export type {
  MountSettingsViewOptions,
  SettingSearchItem,
  SettingSearchMatch,
  SettingsRenderContext,
  SettingsSearchAdapter,
  SettingsSectionDef,
  SettingsViewController,
  SettingsViewStrings,
} from "./types.ts";
