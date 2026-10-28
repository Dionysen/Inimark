import type { ThemeVariable } from "./theme-store.ts";
import type { BuiltinThemeName } from "./builtin.ts";
import { BUILTIN_THEMES } from "./builtin.ts";
import type { ThemeEditorProfile } from "./config.ts";
import { tryGetThemeConfig } from "./config.ts";

/** 主题编辑器分组：按编辑器/界面元素分类 */
export type ThemeEditorSectionId =
  | "body"
  | "chrome"
  | "controls"
  | "codeBlock"
  | "codeInline"
  | "blockquote"
  | "metadata"
  | "table"
  | "tag"
  | "scrollbar";

/** @deprecated 使用 ThemeEditorSectionId；保留别名以免外部引用断裂 */
export type ThemeColorGroup = ThemeEditorSectionId;

export interface ThemeColorToken {
  name: string;
  section: ThemeEditorSectionId;
  /** i18n key under settings.theme.token.* */
  labelKey: string;
  /** Hidden from color editor UI (auto-derived) */
  hidden?: boolean;
  /** If set, only shown when the product editorProfile is one of these. */
  profiles?: ThemeEditorProfile[];
}

export interface ThemeSizeToken {
  name: string;
  section: ThemeEditorSectionId;
  /** i18n key under settings.theme.token.* */
  labelKey: string;
  min: number;
  max: number;
  step?: number;
  /** CSS 单位；默认 `px`。空字符串表示无单位（如 0–1 不透明度） */
  unit?: "px" | "";
  /**
   * 编辑器按 0–100% 显示，但 CSS 存 0–1（仅 unit 为 "" 时有效）。
   * min/max/step 仍按百分比刻度填写（如 0–100）。
   */
  asPercent?: boolean;
  /** If set, only shown when the product editorProfile is one of these. */
  profiles?: ThemeEditorProfile[];
}

export interface ThemeToggleToken {
  name: string;
  section: ThemeEditorSectionId;
  labelKey: string;
  /** If set, only shown when the product editorProfile is one of these. */
  profiles?: ThemeEditorProfile[];
}

export interface ThemeEditorSectionDef {
  id: ThemeEditorSectionId;
  /** i18n key under settings.theme.* */
  titleKey: string;
}

/** Sections shown in the chrome profile (shell-only editors). */
export const CHROME_EDITOR_SECTIONS: ThemeEditorSectionId[] = [
  "body",
  "chrome",
  "controls",
  "scrollbar",
];

export function isChromeEditorSection(id: ThemeEditorSectionId): boolean {
  return (CHROME_EDITOR_SECTIONS as readonly string[]).includes(id);
}

/** Filter editor sections/tokens by product profile (chrome | full). */
export function filterEditorSectionsByProfile(
  sections: ThemeEditorSectionDef[],
  profile?: ThemeEditorProfile,
): ThemeEditorSectionDef[] {
  const resolved = profile ?? tryGetThemeConfig()?.editorProfile ?? "full";
  if (resolved === "full") return sections;
  return sections.filter((s) => isChromeEditorSection(s.id));
}

/** Token-level visibility for the active editor profile. */
export function isTokenVisibleForProfile(
  token: { profiles?: ThemeEditorProfile[] },
  profile?: ThemeEditorProfile,
): boolean {
  if (!token.profiles || token.profiles.length === 0) return true;
  const resolved = profile ?? tryGetThemeConfig()?.editorProfile ?? "full";
  return token.profiles.includes(resolved);
}

/** Chrome-profile field order inside the Interface section (colors + sizes interleaved). */
export const CHROME_INTERFACE_FIELD_ORDER = [
  "--bg-surface",
  "--bg-secondary",
  "--bg-tertiary",
  "--bg-input",
  "--library-volume-bg",
  "--border",
  "--border-width",
  "--accent",
  "--danger",
  "--sidebar-chrome-opacity",
  "--radius-library-bar",
] as const;

function sortChromeInterfaceFields(fields: ThemeEditorField[]): ThemeEditorField[] {
  const rank = new Map<string, number>(
    CHROME_INTERFACE_FIELD_ORDER.map((name, i) => [name, i]),
  );
  return [...fields].sort((a, b) => {
    const ar = rank.get(a.variable.name) ?? 1000;
    const br = rank.get(b.variable.name) ?? 1000;
    return ar - br;
  });
}

/** 编辑器 UI 分组顺序 */
export const THEME_EDITOR_SECTIONS: ThemeEditorSectionDef[] = [
  { id: "body", titleKey: "groupBody" },
  { id: "chrome", titleKey: "groupChrome" },
  { id: "controls", titleKey: "groupControls" },
  { id: "codeBlock", titleKey: "groupCodeBlock" },
  { id: "codeInline", titleKey: "groupCodeInline" },
  { id: "blockquote", titleKey: "groupBlockquote" },
  { id: "metadata", titleKey: "groupMetadata" },
  { id: "table", titleKey: "groupTable" },
  { id: "tag", titleKey: "groupTag" },
  { id: "scrollbar", titleKey: "groupScrollbar" },
];

/** @deprecated 使用 THEME_EDITOR_SECTIONS */
export const THEME_COLOR_GROUPS: ThemeEditorSectionId[] = THEME_EDITOR_SECTIONS.map((s) => s.id);

/** Canonical editable color tokens for the theme editor. */
export const THEME_COLOR_SCHEMA: ThemeColorToken[] = [
  // 编辑器正文
  { name: "--text-primary", section: "body", labelKey: "textPrimary" },
  { name: "--bg-primary", section: "body", labelKey: "bgPrimary" },
  { name: "--text-secondary", section: "body", labelKey: "textSecondary", profiles: ["full"] },
  { name: "--text-tertiary", section: "body", labelKey: "textTertiary", profiles: ["full"] },
  { name: "--text-strong", section: "body", labelKey: "textStrong", profiles: ["full"] },
  // 界面
  { name: "--bg-surface", section: "chrome", labelKey: "bgSurface" },
  { name: "--bg-secondary", section: "chrome", labelKey: "bgSecondary" },
  { name: "--bg-tertiary", section: "chrome", labelKey: "bgTertiary" },
  { name: "--bg-input", section: "chrome", labelKey: "bgInput" },
  { name: "--library-volume-bg", section: "chrome", labelKey: "libraryVolumeBg" },
  { name: "--border", section: "chrome", labelKey: "border" },
  { name: "--accent", section: "chrome", labelKey: "accent" },
  { name: "--danger", section: "chrome", labelKey: "danger" },
  // Derived / Inimark-only chrome colors
  { name: "--bg-menu", section: "chrome", labelKey: "bgMenu", profiles: ["full"] },
  { name: "--bg-hover", section: "chrome", labelKey: "bgHover", profiles: ["full"] },
  { name: "--accent-hover", section: "chrome", labelKey: "accentHover", profiles: ["full"] },
  { name: "--accent-rgb", section: "chrome", labelKey: "accentRgb", hidden: true },
  {
    name: "--tree-indent-hint-color",
    section: "chrome",
    labelKey: "treeIndentHintColor",
    profiles: ["full"],
  },
  { name: "--library-chapter-bg", section: "chrome", labelKey: "libraryChapterBg", profiles: ["full"] },
  {
    name: "--library-chapter-preview",
    section: "chrome",
    labelKey: "libraryChapterPreview",
    profiles: ["full"],
  },
  {
    name: "--library-chapter-meta",
    section: "chrome",
    labelKey: "libraryChapterMeta",
    profiles: ["full"],
  },
  // 代码块
  { name: "--bg-code", section: "codeBlock", labelKey: "bgCode" },
  // 行内代码
  { name: "--bg-code-inline", section: "codeInline", labelKey: "bgCodeInline" },
  { name: "--text-code", section: "codeInline", labelKey: "textCode" },
  { name: "--code-inline-border", section: "codeInline", labelKey: "codeInlineBorder" },
  // 引用块
  { name: "--blockquote-border", section: "blockquote", labelKey: "blockquoteBorder" },
  { name: "--blockquote-bg", section: "blockquote", labelKey: "blockquoteBg" },
  { name: "--blockquote-text", section: "blockquote", labelKey: "blockquoteText" },
  // Metadata
  { name: "--metadata-bg", section: "metadata", labelKey: "metadataBg" },
  { name: "--metadata-border", section: "metadata", labelKey: "metadataBorder" },
  // 表格
  { name: "--table-header-bg", section: "table", labelKey: "tableHeaderBg" },
  { name: "--table-cell-bg", section: "table", labelKey: "tableCellBg" },
  // 标签
  { name: "--tag-bg", section: "tag", labelKey: "tagBg" },
  { name: "--tag-text", section: "tag", labelKey: "tagText" },
  { name: "--tag-border", section: "tag", labelKey: "tagBorder" },
  // 滚动条
  { name: "--scrollbar-thumb", section: "scrollbar", labelKey: "scrollbarThumb" },
  { name: "--scrollbar-thumb-hover", section: "scrollbar", labelKey: "scrollbarThumbHover" },
  { name: "--scrollbar-track", section: "scrollbar", labelKey: "scrollbarTrack" },
];

/** Radius / padding / width tokens shown in the theme editor. */
export const THEME_SIZE_SCHEMA: ThemeSizeToken[] = [
  {
    name: "--sidebar-chrome-opacity",
    section: "chrome",
    labelKey: "sidebarChromeOpacity",
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    asPercent: true,
  },
  { name: "--radius-library-bar", section: "chrome", labelKey: "radiusLibraryBar", min: 0, max: 24 },
  { name: "--border-width", section: "chrome", labelKey: "borderWidth", min: 0, max: 5 },
  { name: "--radius-control", section: "controls", labelKey: "radiusControl", min: 0, max: 16 },
  { name: "--control-height", section: "controls", labelKey: "controlHeight", min: 24, max: 44 },
  { name: "--control-padding-x", section: "controls", labelKey: "controlPaddingX", min: 4, max: 24 },
  { name: "--control-font-size", section: "controls", labelKey: "controlFontSize", min: 9, max: 36 },
  { name: "--menu-item-padding-y", section: "controls", labelKey: "menuItemPaddingY", min: 2, max: 16 },
  {
    name: "--tree-item-padding-y",
    section: "controls",
    labelKey: "treeItemPaddingY",
    min: 2,
    max: 16,
    profiles: ["full"],
  },
  {
    name: "--tree-indent-hint-width",
    section: "controls",
    labelKey: "treeIndentHintWidth",
    min: 1,
    max: 4,
    profiles: ["full"],
  },
  {
    name: "--tree-indent-hint-size",
    section: "controls",
    labelKey: "treeIndentHintSize",
    min: 8,
    max: 28,
    profiles: ["full"],
  },
  { name: "--radius-code-block", section: "codeBlock", labelKey: "radiusCodeBlock", min: 0, max: 24 },
  { name: "--radius-code-inline", section: "codeInline", labelKey: "radiusCodeInline", min: 0, max: 16 },
  { name: "--padding-code-inline-y", section: "codeInline", labelKey: "paddingCodeInlineY", min: 0, max: 16 },
  { name: "--padding-code-inline-x", section: "codeInline", labelKey: "paddingCodeInlineX", min: 0, max: 24 },
  {
    name: "--code-inline-border-width",
    section: "codeInline",
    labelKey: "codeInlineBorderWidth",
    min: 0,
    max: 8,
  },
  { name: "--blockquote-border-width", section: "blockquote", labelKey: "blockquoteBorderWidth", min: 0, max: 16 },
  { name: "--padding-blockquote-y", section: "blockquote", labelKey: "paddingBlockquoteY", min: 0, max: 32 },
  { name: "--padding-blockquote-x", section: "blockquote", labelKey: "paddingBlockquoteX", min: 0, max: 48 },
  { name: "--radius-metadata", section: "metadata", labelKey: "radiusMetadata", min: 0, max: 24 },
  { name: "--margin-metadata-bottom", section: "metadata", labelKey: "marginMetadataBottom", min: 0, max: 64 },
  { name: "--radius-table", section: "table", labelKey: "radiusTable", min: 0, max: 24 },
  { name: "--radius-tag", section: "tag", labelKey: "radiusTag", min: 0, max: 24 },
  { name: "--padding-tag-y", section: "tag", labelKey: "paddingTagY", min: 0, max: 16 },
  { name: "--padding-tag-x", section: "tag", labelKey: "paddingTagX", min: 0, max: 24 },
  { name: "--radius-scrollbar", section: "scrollbar", labelKey: "radiusScrollbar", min: 0, max: 16 },
  { name: "--scrollbar-size", section: "scrollbar", labelKey: "scrollbarSize", min: 4, max: 20 },
];

/** Boolean-ish 0/1 tokens shown as toggles in the theme editor. */
export const THEME_TOGGLE_SCHEMA: ThemeToggleToken[] = [
  {
    name: "--tree-indent-hint-visible",
    section: "controls",
    labelKey: "treeIndentHintVisible",
    profiles: ["full"],
  },
];

export type ThemeEditorField =
  | { kind: "color"; variable: ThemeVariable; meta: ThemeColorToken }
  | { kind: "size"; variable: ThemeVariable; meta: ThemeSizeToken }
  | { kind: "toggle"; variable: ThemeVariable; meta: ThemeToggleToken };

export interface ThemeEditorSectionView {
  id: ThemeEditorSectionId;
  titleKey: string;
  fields: ThemeEditorField[];
}

/** Non-color vars preserved when forking / rebuilding CSS. */
const PRESERVED_NON_COLOR = [
  "--font-mono",
  "--font-ui",
  "--editor-font",
  "--editor-font-size",
  "--font-mono-size",
  "--sidebar-chrome-opacity",
  "--radius-library-bar",
  "--border-width",
  "--radius-control",
  "--control-height",
  "--control-padding-x",
  "--control-font-size",
  "--menu-item-padding-y",
  "--tree-item-padding-y",
  "--tree-indent-hint-width",
  "--tree-indent-hint-size",
  "--tree-indent-hint-visible",
  "--radius-code-block",
  "--radius-code-inline",
  "--padding-code-inline-y",
  "--padding-code-inline-x",
  "--code-inline-border-width",
  "--radius-metadata",
  "--margin-metadata-bottom",
  "--blockquote-border-width",
  "--padding-blockquote-y",
  "--padding-blockquote-x",
  "--radius-table",
  "--radius-tag",
  "--padding-tag-y",
  "--padding-tag-x",
  "--radius-scrollbar",
  "--scrollbar-size",
] as const;

const LIGHT_DEFAULTS: Record<string, string> = {
  "--bg-primary": "#ffffff",
  "--bg-secondary": "#f8f9fb",
  "--bg-surface": "#fafbfc",
  "--bg-menu": "#ffffff",
  "--bg-hover": "rgba(0, 0, 0, 0.04)",
  "--bg-tertiary": "#f1f3f5",
  "--bg-code": "#f6f8fa",
  "--bg-code-inline": "rgba(175, 184, 193, 0.2)",
  "--bg-input": "#ffffff",
  "--text-primary": "#1f2328",
  "--text-secondary": "#656d76",
  "--text-tertiary": "#8c959f",
  "--text-strong": "#1f2328",
  "--text-code": "#0550ae",
  "--accent": "#0078d4",
  "--accent-rgb": "0, 120, 212",
  "--accent-hover": "#005a9e",
  "--danger": "#cf222e",
  "--border": "#e5e5e5",
  "--code-inline-border": "#d0d7de",
  "--scrollbar-thumb": "#c8c8c8",
  "--scrollbar-thumb-hover": "#8c959f",
  "--scrollbar-track": "transparent",
  "--metadata-bg": "#f6f8fa",
  "--metadata-border": "#d0d7de",
  "--blockquote-border": "#d0d7de",
  "--blockquote-bg": "transparent",
  "--blockquote-text": "#656d76",
  "--table-header-bg": "#f6f8fa",
  "--table-cell-bg": "transparent",
  "--tag-bg": "rgba(0, 120, 212, 0.12)",
  "--tag-text": "#005a9e",
  "--tag-border": "rgba(0, 120, 212, 0.22)",
  "--library-volume-bg": "#ffffff",
  "--library-chapter-bg": "rgba(255, 255, 255, 0.72)",
  "--library-chapter-preview": "#8c959f",
  "--library-chapter-meta": "#a0a8b0",
};

const DARK_DEFAULTS: Record<string, string> = {
  "--bg-primary": "#1b1d24",
  "--bg-secondary": "#111217",
  "--bg-surface": "#1b1d24",
  "--bg-menu": "#101116",
  "--bg-hover": "rgba(255, 255, 255, 0.08)",
  "--bg-tertiary": "#1b1d24",
  "--bg-code": "#1f2129",
  "--bg-code-inline": "#181a21",
  "--bg-input": "#0c0c10",
  "--text-primary": "#c1c3c2",
  "--text-secondary": "#818286",
  "--text-tertiary": "#5c5e63",
  "--text-strong": "#ffffff",
  "--text-code": "#ebebeb",
  "--accent": "#74a7fe",
  "--accent-rgb": "116, 167, 254",
  "--accent-hover": "#3a88fe",
  "--danger": "#e06c75",
  "--border": "rgba(161, 161, 170, 0.14)",
  "--code-inline-border": "rgba(110, 115, 121, 0.277)",
  "--scrollbar-thumb": "#aaaaaa",
  "--scrollbar-thumb-hover": "#6B6B6B",
  "--scrollbar-track": "transparent",
  "--metadata-bg": "#1f2129",
  "--metadata-border": "rgba(68, 68, 68, 0.509)",
  "--blockquote-border": "rgba(255, 255, 255, 0.15)",
  "--blockquote-bg": "#21232b",
  "--blockquote-text": "#9e9e9e",
  "--table-header-bg": "#17191e",
  "--table-cell-bg": "#1f2129",
  "--tag-bg": "rgba(16, 111, 255, 0.171)",
  "--tag-text": "#6390d4",
  "--tag-border": "rgba(16, 111, 255, 0.345)",
  "--tree-indent-hint-color": "rgba(145, 145, 145, 0.159)",
  "--library-volume-bg": "#1b1d24",
  "--library-chapter-bg": "rgba(255, 255, 255, 0.025)",
  "--library-chapter-preview": "#5c5e63",
  "--library-chapter-meta": "#4a4c52",
};

/** Full color maps for each built-in theme (for fork / theme editor).
 * Runtime styles live in `styles/themes.css` via `[data-theme="…"]`.
 * Keep these maps in sync with that CSS — editing only this file will not change the live UI. */
export const BUILTIN_THEME_COLORS: Record<BuiltinThemeName, Record<string, string>> = {
  light: {
    "--bg-primary": "#ffffff",
    "--bg-secondary": "#f8f9fb",
    "--bg-surface": "#fafbfc",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(0, 0, 0, 0.04)",
    "--bg-tertiary": "#f1f3f5",
    "--bg-code": "#f6f8fa",
    "--bg-code-inline": "rgba(175, 184, 193, 0.2)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1f2328",
    "--text-secondary": "#656d76",
    "--text-tertiary": "#8c959f",
    "--text-strong": "#1f2328",
    "--text-code": "#0550ae",
    "--accent": "#0078d4",
    "--accent-rgb": "0, 120, 212",
    "--accent-hover": "#005a9e",
    "--border": "#e5e5e5",
    "--danger": "#cf222e",
    "--code-inline-border": "#d0d7de",
    "--blockquote-border": "#d0d7de",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#656d76",
    "--metadata-bg": "#f6f8fa",
    "--metadata-border": "#d0d7de",
    "--table-header-bg": "#f6f8fa",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(0, 120, 212, 0.12)",
    "--tag-text": "#005a9e",
    "--tag-border": "rgba(0, 120, 212, 0.22)",
    "--scrollbar-thumb": "#c8c8c8",
    "--scrollbar-thumb-hover": "#8c959f",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#e5e5e5",
    "--library-volume-bg": "#ffffff",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.72)",
    "--library-chapter-preview": "#8c959f",
    "--library-chapter-meta": "#a0a8b0",
  },
  grey: {
    "--bg-primary": "#fafbfc",
    "--bg-secondary": "#f0f2f5",
    "--bg-surface": "#f5f6f8",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(71, 85, 105, 0.07)",
    "--bg-tertiary": "#e8ebf0",
    "--bg-code": "#f0f2f5",
    "--bg-code-inline": "rgba(100, 116, 139, 0.1)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1e2430",
    "--text-secondary": "#5b6575",
    "--text-tertiary": "#8b95a5",
    "--text-strong": "#0f172a",
    "--text-code": "#334155",
    "--accent": "#475569",
    "--accent-rgb": "71, 85, 105",
    "--accent-hover": "#334155",
    "--border": "#e2e6ec",
    "--danger": "#cf222e",
    "--code-inline-border": "#e2e6ec",
    "--blockquote-border": "#cbd5e1",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#5b6575",
    "--metadata-bg": "#f0f2f5",
    "--metadata-border": "#e2e6ec",
    "--table-header-bg": "#f0f2f5",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(71, 85, 105, 0.12)",
    "--tag-text": "#334155",
    "--tag-border": "rgba(71, 85, 105, 0.22)",
    "--scrollbar-thumb": "#d0d5dc",
    "--scrollbar-thumb-hover": "#8b95a5",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#e2e6ec",
    "--library-volume-bg": "#fafbfc",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.7)",
    "--library-chapter-preview": "#8b95a5",
    "--library-chapter-meta": "#9aa3b0",
  },
  slate: {
    "--bg-primary": "#fafafa",
    "--bg-secondary": "#f4f4f5",
    "--bg-surface": "#f6f6f7",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(24, 24, 27, 0.06)",
    "--bg-tertiary": "#e4e4e7",
    "--bg-code": "#f4f4f5",
    "--bg-code-inline": "rgba(63, 63, 70, 0.1)",
    "--bg-input": "#ffffff",
    "--text-primary": "#18181b",
    "--text-secondary": "#52525b",
    "--text-tertiary": "#a1a1aa",
    "--text-strong": "#09090b",
    "--text-code": "#3f3f46",
    "--accent": "#52525b",
    "--accent-rgb": "82, 82, 91",
    "--accent-hover": "#3f3f46",
    "--border": "#e4e4e7",
    "--danger": "#cf222e",
    "--code-inline-border": "#e4e4e7",
    "--blockquote-border": "#d4d4d8",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#52525b",
    "--metadata-bg": "#f4f4f5",
    "--metadata-border": "#e4e4e7",
    "--table-header-bg": "#f4f4f5",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(82, 82, 91, 0.12)",
    "--tag-text": "#3f3f46",
    "--tag-border": "rgba(82, 82, 91, 0.22)",
    "--scrollbar-thumb": "#d4d4d8",
    "--scrollbar-thumb-hover": "#a1a1aa",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#e4e4e7",
    "--library-volume-bg": "#fafafa",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.72)",
    "--library-chapter-preview": "#a1a1aa",
    "--library-chapter-meta": "#b4b4bc",
  },
  "claude-code": {
    "--bg-primary": "#faf8f5",
    "--bg-secondary": "#f3efe8",
    "--bg-surface": "#f7f3ed",
    "--bg-menu": "#faf8f5",
    "--bg-hover": "rgba(180, 108, 37, 0.09)",
    "--bg-tertiary": "#ebe4d9",
    "--bg-code": "#f3efe8",
    "--bg-code-inline": "rgba(180, 108, 37, 0.1)",
    "--bg-input": "#faf8f5",
    "--text-primary": "#1c1917",
    "--text-secondary": "#6b6560",
    "--text-tertiary": "#9a948c",
    "--text-strong": "#1c1917",
    "--text-code": "#9a3412",
    "--accent": "#c47a2a",
    "--accent-rgb": "196, 122, 42",
    "--accent-hover": "#a86420",
    "--border": "#e4ddd3",
    "--danger": "#c94432",
    "--code-inline-border": "#e4ddd3",
    "--blockquote-border": "#d6cdc0",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#6b6560",
    "--metadata-bg": "#f3efe8",
    "--metadata-border": "#e4ddd3",
    "--table-header-bg": "#f3efe8",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(196, 122, 42, 0.12)",
    "--tag-text": "#a86420",
    "--tag-border": "rgba(196, 122, 42, 0.22)",
    "--scrollbar-thumb": "#d6cdc0",
    "--scrollbar-thumb-hover": "#9a948c",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#e4ddd3",
    "--library-volume-bg": "#faf8f5",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.5)",
    "--library-chapter-preview": "#8a847c",
    "--library-chapter-meta": "#9e9890",
  },
  mint: {
    "--bg-primary": "#fbfefc",
    "--bg-secondary": "#eef6f2",
    "--bg-surface": "#f4faf7",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(45, 140, 105, 0.09)",
    "--bg-tertiary": "#e2f0e9",
    "--bg-code": "#f0f7f4",
    "--bg-code-inline": "rgba(45, 140, 105, 0.1)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1a2e28",
    "--text-secondary": "#4d645c",
    "--text-tertiary": "#7a9188",
    "--text-strong": "#0f2922",
    "--text-code": "#0f766e",
    "--accent": "#2d8c69",
    "--accent-rgb": "45, 140, 105",
    "--accent-hover": "#247556",
    "--border": "#d3e5dc",
    "--danger": "#cf222e",
    "--code-inline-border": "#d3e5dc",
    "--blockquote-border": "#b9d4c7",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#4d645c",
    "--metadata-bg": "#f0f7f4",
    "--metadata-border": "#d3e5dc",
    "--table-header-bg": "#eef6f2",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(45, 140, 105, 0.12)",
    "--tag-text": "#247556",
    "--tag-border": "rgba(45, 140, 105, 0.22)",
    "--scrollbar-thumb": "#c5d9cf",
    "--scrollbar-thumb-hover": "#7a9188",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#d3e5dc",
    "--library-volume-bg": "#fbfefc",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.55)",
    "--library-chapter-preview": "#7a9188",
    "--library-chapter-meta": "#8ea59c",
  },
  purple: {
    "--bg-primary": "#fcfbfe",
    "--bg-secondary": "#f5f3f9",
    "--bg-surface": "#f8f6fb",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(109, 40, 217, 0.08)",
    "--bg-tertiary": "#ebe6f4",
    "--bg-code": "#f5f3f9",
    "--bg-code-inline": "rgba(109, 40, 217, 0.08)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1e1b2e",
    "--text-secondary": "#5f5875",
    "--text-tertiary": "#8f88a5",
    "--text-strong": "#2e1065",
    "--text-code": "#6d28d9",
    "--accent": "#7c3aed",
    "--accent-rgb": "124, 58, 237",
    "--accent-hover": "#6d28d9",
    "--border": "#e4dff0",
    "--danger": "#cf222e",
    "--code-inline-border": "#e4dff0",
    "--blockquote-border": "#d4cce8",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#5f5875",
    "--metadata-bg": "#f5f3f9",
    "--metadata-border": "#e4dff0",
    "--table-header-bg": "#f5f3f9",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(124, 58, 237, 0.1)",
    "--tag-text": "#6d28d9",
    "--tag-border": "rgba(124, 58, 237, 0.2)",
    "--scrollbar-thumb": "#d4cce8",
    "--scrollbar-thumb-hover": "#8f88a5",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#e4dff0",
    "--library-volume-bg": "#fcfbfe",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.6)",
    "--library-chapter-preview": "#8f88a5",
    "--library-chapter-meta": "#a29bb5",
  },
  hermes: {
    "--bg-primary": "#f8f9ff",
    "--bg-secondary": "#eef0fb",
    "--bg-surface": "#f2f3fc",
    "--bg-menu": "#ffffff",
    "--bg-hover": "rgba(67, 56, 202, 0.08)",
    "--bg-tertiary": "#e4e7f7",
    "--bg-code": "#eef0fb",
    "--bg-code-inline": "rgba(67, 56, 202, 0.08)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1e1b4b",
    "--text-secondary": "#4c4f7a",
    "--text-tertiary": "#8084ad",
    "--text-strong": "#1e1b4b",
    "--text-code": "#3730a3",
    "--accent": "#4338ca",
    "--accent-rgb": "67, 56, 202",
    "--accent-hover": "#3730a3",
    "--border": "#dfe2f2",
    "--danger": "#cf222e",
    "--code-inline-border": "#dfe2f2",
    "--blockquote-border": "#c9cee8",
    "--blockquote-bg": "transparent",
    "--blockquote-text": "#4c4f7a",
    "--metadata-bg": "#eef0fb",
    "--metadata-border": "#dfe2f2",
    "--table-header-bg": "#eef0fb",
    "--table-cell-bg": "transparent",
    "--tag-bg": "rgba(67, 56, 202, 0.1)",
    "--tag-text": "#3730a3",
    "--tag-border": "rgba(67, 56, 202, 0.2)",
    "--scrollbar-thumb": "#c9cee8",
    "--scrollbar-thumb-hover": "#8084ad",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "#dfe2f2",
    "--library-volume-bg": "#f8f9ff",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.55)",
    "--library-chapter-preview": "#8084ad",
    "--library-chapter-meta": "#9497b8",
  },
  ocean: {
    "--bg-primary": "#1b1d24",
    "--bg-secondary": "#111217",
    "--bg-surface": "#1b1d24",
    "--bg-menu": "#101116",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#1b1d24",
    "--bg-code": "#1f2129",
    "--bg-code-inline": "#181a21",
    "--bg-input": "#0c0c10",
    "--text-primary": "#c1c3c2",
    "--text-secondary": "#818286",
    "--text-tertiary": "#5c5e63",
    "--text-strong": "#ffffff",
    "--text-code": "#ebebeb",
    "--accent": "#74a7fe",
    "--accent-rgb": "116, 167, 254",
    "--accent-hover": "#3a88fe",
    "--border": "rgba(161, 161, 170, 0.14)",
    "--danger": "#e06c75",
    "--code-inline-border": "rgba(110, 115, 121, 0.277)",
    "--blockquote-border": "rgba(255, 255, 255, 0.15)",
    "--blockquote-bg": "#21232b",
    "--blockquote-text": "#9e9e9e",
    "--metadata-bg": "#1f2129",
    "--metadata-border": "rgba(68, 68, 68, 0.509)",
    "--table-header-bg": "#17191e",
    "--table-cell-bg": "#1f2129",
    "--tag-bg": "rgba(16, 111, 255, 0.171)",
    "--tag-text": "#6390d4",
    "--tag-border": "rgba(16, 111, 255, 0.345)",
    "--scrollbar-thumb": "#aaaaaa",
    "--scrollbar-thumb-hover": "#6b6b6b",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "rgba(145, 145, 145, 0.159)",
    "--library-volume-bg": "#1b1d24",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.025)",
    "--library-chapter-preview": "#5c5e63",
    "--library-chapter-meta": "#4a4c52",
  },
  "dark-modern": {
    "--bg-primary": "#1f1f1f",
    "--bg-secondary": "#181818",
    "--bg-surface": "#181818",
    "--bg-menu": "#181818",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#1b1d24",
    "--bg-code": "#27292c",
    "--bg-code-inline": "#34373b",
    "--bg-input": "#181818",
    "--text-primary": "#e0e0e0",
    "--text-secondary": "#c4c4c6",
    "--text-tertiary": "#5c5e63",
    "--text-strong": "#ffffff",
    "--text-code": "#ebebeb",
    "--accent": "#74a7fe",
    "--accent-rgb": "116, 167, 254",
    "--accent-hover": "#3a88fe",
    "--border": "rgba(161, 161, 170, 0.14)",
    "--danger": "#e06c75",
    "--code-inline-border": "rgba(110, 115, 121, 0.277)",
    "--blockquote-border": "rgba(255, 255, 255, 0.15)",
    "--blockquote-bg": "rgba(48, 51, 55, 0.327)",
    "--blockquote-text": "#9e9e9e",
    "--metadata-bg": "#27292c",
    "--metadata-border": "rgba(68, 68, 68, 0.509)",
    "--table-header-bg": "#1c1c1c",
    "--table-cell-bg": "#262626",
    "--tag-bg": "rgba(16, 111, 255, 0.171)",
    "--tag-text": "#6390d4",
    "--tag-border": "rgba(16, 111, 255, 0.345)",
    "--scrollbar-thumb": "rgba(107, 107, 107, 0.294)",
    "--scrollbar-thumb-hover": "rgba(107, 107, 107, 0.294)",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "rgba(145, 145, 145, 0.159)",
    "--library-volume-bg": "#1f1f1f",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.03)",
    "--library-chapter-preview": "#8e8e92",
    "--library-chapter-meta": "#6e6e74",
    "--blockquote-border-width": "4px",
    "--scrollbar-size": "9px",
  },
  "rider-dark": {
    "--bg-primary": "#191a1c",
    "--bg-secondary": "#26282b",
    "--bg-surface": "#2b2d30",
    "--bg-menu": "#2b2d30",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#1b1d24",
    "--bg-code": "#2b2d30",
    "--bg-code-inline": "#2b2d30",
    "--bg-input": "#242425",
    "--text-primary": "#c1c3c2",
    "--text-secondary": "#c6c6c6",
    "--text-tertiary": "#5c5e63",
    "--text-strong": "#ffffff",
    "--text-code": "#ebebeb",
    "--accent": "#74a7fe",
    "--accent-rgb": "116, 167, 254",
    "--accent-hover": "#3a88fe",
    "--border": "rgba(161, 161, 170, 0.14)",
    "--danger": "#e06c75",
    "--code-inline-border": "rgba(110, 115, 121, 0.277)",
    "--blockquote-border": "rgba(255, 255, 255, 0.15)",
    "--blockquote-bg": "#2b2d30",
    "--blockquote-text": "#9e9e9e",
    "--metadata-bg": "#1f2129",
    "--metadata-border": "rgba(68, 68, 68, 0.509)",
    "--table-header-bg": "#232425",
    "--table-cell-bg": "#2b2d30",
    "--tag-bg": "rgba(16, 111, 255, 0.171)",
    "--tag-text": "#6390d4",
    "--tag-border": "rgba(16, 111, 255, 0.345)",
    "--scrollbar-thumb": "#aaaaaa",
    "--scrollbar-thumb-hover": "#6b6b6b",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "rgba(145, 145, 145, 0.159)",
    "--library-volume-bg": "#191a1c",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.03)",
    "--library-chapter-preview": "#8e8e92",
    "--library-chapter-meta": "#6e6e74",
  },
  cursor: {
    "--bg-primary": "#141414",
    "--bg-secondary": "#0f0f0f",
    "--bg-surface": "#1a1a1a",
    "--bg-menu": "#1a1a1a",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#222222",
    "--bg-code": "#1e1e1e",
    "--bg-code-inline": "#2a2a2a",
    "--bg-input": "#0f0f0f",
    "--text-primary": "#c1c3c2",
    "--text-secondary": "#a1a1aa",
    "--text-tertiary": "#71717a",
    "--text-strong": "#ffffff",
    "--text-code": "#e4e4e7",
    "--accent": "#3b82f6",
    "--accent-rgb": "59, 130, 246",
    "--accent-hover": "#2563eb",
    "--border": "rgba(161, 161, 170, 0.14)",
    "--danger": "#ef4444",
    "--code-inline-border": "rgba(110, 115, 121, 0.277)",
    "--blockquote-border": "rgba(255, 255, 255, 0.12)",
    "--blockquote-bg": "rgba(59, 130, 246, 0.08)",
    "--blockquote-text": "#a1a1aa",
    "--metadata-bg": "#1e1e1e",
    "--metadata-border": "rgba(68, 68, 68, 0.509)",
    "--table-header-bg": "#0f0f0f",
    "--table-cell-bg": "#1a1a1a",
    "--tag-bg": "rgba(59, 130, 246, 0.171)",
    "--tag-text": "#60a5fa",
    "--tag-border": "rgba(59, 130, 246, 0.345)",
    "--scrollbar-thumb": "rgba(161, 161, 170, 0.35)",
    "--scrollbar-thumb-hover": "rgba(161, 161, 170, 0.55)",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "rgba(161, 161, 170, 0.14)",
    "--library-volume-bg": "#141414",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.02)",
    "--library-chapter-preview": "#71717a",
    "--library-chapter-meta": "#52525b",
  },
  dracula: {
    "--bg-primary": "#282a36",
    "--bg-secondary": "#21222c",
    "--bg-surface": "#343746",
    "--bg-menu": "#21222c",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#44475a",
    "--bg-code": "#21222c",
    "--bg-code-inline": "#44475a",
    "--bg-input": "#21222c",
    "--text-primary": "#f8f8f2",
    "--text-secondary": "#bd93f9",
    "--text-tertiary": "#6272a4",
    "--text-strong": "#ffffff",
    "--text-code": "#f1fa8c",
    "--accent": "#bd93f9",
    "--accent-rgb": "189, 147, 249",
    "--accent-hover": "#ff79c6",
    "--border": "rgba(161, 161, 170, 0.14)",
    "--danger": "#ff5555",
    "--code-inline-border": "rgba(98, 114, 164, 0.45)",
    "--blockquote-border": "#6272a4",
    "--blockquote-bg": "rgba(68, 71, 90, 0.45)",
    "--blockquote-text": "#bd93f9",
    "--metadata-bg": "#21222c",
    "--metadata-border": "rgba(68, 71, 90, 0.85)",
    "--table-header-bg": "#21222c",
    "--table-cell-bg": "#282a36",
    "--tag-bg": "rgba(189, 147, 249, 0.18)",
    "--tag-text": "#bd93f9",
    "--tag-border": "rgba(189, 147, 249, 0.35)",
    "--scrollbar-thumb": "#44475a",
    "--scrollbar-thumb-hover": "#6272a4",
    "--scrollbar-track": "transparent",
    "--tree-indent-hint-color": "rgba(68, 71, 90, 0.85)",
    "--library-volume-bg": "#282a36",
    "--library-chapter-bg": "rgba(255, 255, 255, 0.03)",
    "--library-chapter-preview": "#6272a4",
    "--library-chapter-meta": "#4d5a80",
  },
};

const DEFAULT_FONTS: ThemeVariable[] = [
  {
    name: "--font-mono",
    value: '"Cascadia Code", "JetBrains Mono", "Fira Code", "Consolas", monospace',
    type: "font",
  },
  {
    name: "--font-ui",
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    type: "font",
  },
  {
    name: "--editor-font",
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    type: "font",
  },
  { name: "--editor-font-size", value: "16px", type: "size" },
  { name: "--font-mono-size", value: "14px", type: "size" },
];

const DEFAULT_SIZES: ThemeVariable[] = [
  { name: "--sidebar-chrome-opacity", value: "0.21", type: "size" },
  { name: "--radius-library-bar", value: "4px", type: "size" },
  { name: "--border-width", value: "1px", type: "size" },
  { name: "--radius-control", value: "4px", type: "size" },
  { name: "--control-height", value: "32px", type: "size" },
  { name: "--control-padding-x", value: "10px", type: "size" },
  { name: "--control-font-size", value: "13px", type: "size" },
  { name: "--menu-item-padding-y", value: "6px", type: "size" },
  { name: "--tree-item-padding-y", value: "5px", type: "size" },
  { name: "--tree-indent-hint-width", value: "1px", type: "size" },
  { name: "--tree-indent-hint-size", value: "14px", type: "size" },
  { name: "--tree-indent-hint-visible", value: "1", type: "size" },
  { name: "--radius-code-block", value: "2px", type: "size" },
  { name: "--radius-code-inline", value: "2px", type: "size" },
  { name: "--padding-code-inline-y", value: "1px", type: "size" },
  { name: "--padding-code-inline-x", value: "3px", type: "size" },
  { name: "--code-inline-border-width", value: "1px", type: "size" },
  { name: "--radius-metadata", value: "2px", type: "size" },
  { name: "--margin-metadata-bottom", value: "40px", type: "size" },
  { name: "--blockquote-border-width", value: "3px", type: "size" },
  { name: "--padding-blockquote-y", value: "4px", type: "size" },
  { name: "--padding-blockquote-x", value: "16px", type: "size" },
  { name: "--radius-table", value: "2px", type: "size" },
  { name: "--radius-tag", value: "20px", type: "size" },
  { name: "--padding-tag-y", value: "2px", type: "size" },
  { name: "--padding-tag-x", value: "7px", type: "size" },
  { name: "--radius-scrollbar", value: "2px", type: "size" },
  { name: "--scrollbar-size", value: "6px", type: "size" },
];

/** Per-builtin chrome size overrides (keep in sync with themes.css). */
const BUILTIN_THEME_SIZE_OVERRIDES: Partial<
  Record<BuiltinThemeName, Record<string, string>>
> = {
  "dark-modern": {
    "--padding-code-inline-y": "0px",
    "--blockquote-border-width": "4px",
    "--padding-blockquote-y": "13px",
    "--scrollbar-size": "9px",
  },
};

function sizesForBuiltin(builtinId: BuiltinThemeName): ThemeVariable[] {
  const overrides = BUILTIN_THEME_SIZE_OVERRIDES[builtinId];
  if (!overrides) return DEFAULT_SIZES;
  return DEFAULT_SIZES.map((token) => {
    const value = overrides[token.name];
    return value ? { ...token, value } : token;
  });
}

function resolveColorTokenValue(
  token: ThemeColorToken,
  colors: Record<string, string>,
  defaults: Record<string, string>,
): string {
  if (colors[token.name]) return colors[token.name];
  if (token.name === "--scrollbar-thumb" && colors["--border"]) return colors["--border"];
  if (token.name === "--scrollbar-thumb-hover" && colors["--text-secondary"]) {
    return colors["--text-secondary"];
  }
  if (token.name === "--scrollbar-track") return colors[token.name] ?? "transparent";
  if (token.name === "--code-inline-border" && colors["--border"]) return colors["--border"];
  if (token.name === "--metadata-bg" && colors["--bg-secondary"]) return colors["--bg-secondary"];
  if (token.name === "--bg-menu" && colors["--bg-tertiary"]) return colors["--bg-tertiary"];
  if (token.name === "--metadata-border" && colors["--border"]) return colors["--border"];
  if (token.name === "--blockquote-border" && colors["--border"]) return colors["--border"];
  if (token.name === "--blockquote-bg") return colors[token.name] ?? "transparent";
  if (token.name === "--blockquote-text" && colors["--text-secondary"]) {
    return colors["--text-secondary"];
  }
  if (token.name === "--table-header-bg" && colors["--bg-secondary"]) {
    return colors["--bg-secondary"];
  }
  if (token.name === "--table-cell-bg") return colors[token.name] ?? "transparent";
  if (token.name === "--tag-text" && colors["--accent"]) return colors["--accent"];
  if (token.name === "--tag-bg" && colors["--accent-rgb"]) {
    return `rgba(${colors["--accent-rgb"]}, 0.15)`;
  }
  if (token.name === "--tag-border" && colors["--accent-rgb"]) {
    return `rgba(${colors["--accent-rgb"]}, 0.2)`;
  }
  if (token.name === "--tree-indent-hint-color" && colors["--border"]) {
    return colors["--border"];
  }
  if (token.name === "--library-volume-bg") {
    return (
      colors[token.name] ??
      colors["--bg-primary"] ??
      defaults[token.name] ??
      LIGHT_DEFAULTS["--bg-primary"] ??
      "#ffffff"
    );
  }
  if (token.name === "--library-chapter-bg") {
    return colors[token.name] ?? colors["--bg-secondary"] ?? defaults[token.name] ?? "transparent";
  }
  if (token.name === "--library-chapter-preview" || token.name === "--library-chapter-meta") {
    return (
      colors[token.name] ??
      colors["--text-tertiary"] ??
      defaults[token.name] ??
      LIGHT_DEFAULTS["--text-tertiary"] ??
      "#94a3b8"
    );
  }
  return defaults[token.name] ?? LIGHT_DEFAULTS[token.name] ?? "#ffffff";
}

export function getBuiltinColorMap(builtinId: string): Record<string, string> | null {
  if (!(BUILTIN_THEMES as readonly string[]).includes(builtinId)) return null;
  return BUILTIN_THEME_COLORS[builtinId as BuiltinThemeName];
}

export function colorMapToVariables(colors: Record<string, string>): ThemeVariable[] {
  return THEME_COLOR_SCHEMA.map((token) => ({
    name: token.name,
    value: resolveColorTokenValue(token, colors, LIGHT_DEFAULTS),
    type: "color" as const,
  }));
}

export function getBuiltinThemeVariables(builtinId: string): ThemeVariable[] | null {
  const colors = getBuiltinColorMap(builtinId);
  if (!colors) return null;
  return [
    ...colorMapToVariables(colors),
    ...DEFAULT_FONTS,
    ...sizesForBuiltin(builtinId as BuiltinThemeName),
  ];
}

export function getTemplateVariables(kind: "light" | "dark"): ThemeVariable[] {
  const colors = kind === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
  return [...colorMapToVariables(colors), ...DEFAULT_FONTS, ...DEFAULT_SIZES];
}

/**
 * Merge parsed CSS vars with the canonical color schema.
 * Missing color tokens get defaults from `fallback` or light template.
 * Non-schema vars (fonts, extras from imports) are preserved after schema colors.
 */
export function mergeWithSchema(
  parsed: ThemeVariable[],
  fallback?: Record<string, string>,
): ThemeVariable[] {
  const byName = new Map(parsed.map((v) => [v.name, v]));
  const defaults = fallback ?? LIGHT_DEFAULTS;
  const parsedColors: Record<string, string> = {};
  for (const v of parsed) {
    parsedColors[v.name] = v.value;
  }
  const colorDefaults: Record<string, string> = { ...LIGHT_DEFAULTS, ...defaults, ...parsedColors };
  const colors: ThemeVariable[] = THEME_COLOR_SCHEMA.map((token) => {
    const existing = byName.get(token.name);
    if (existing) {
      byName.delete(token.name);
      return { ...existing, type: "color" as const };
    }
    return {
      name: token.name,
      value: resolveColorTokenValue(token, colorDefaults, LIGHT_DEFAULTS),
      type: "color" as const,
    };
  });

  // Keep remaining non-color / extra vars (fonts etc.)
  const rest: ThemeVariable[] = [];
  for (const name of PRESERVED_NON_COLOR) {
    const v = byName.get(name);
    if (v) {
      rest.push(v);
      byName.delete(name);
    }
  }
  // Defaults fonts / sizes if missing
  for (const def of [...DEFAULT_FONTS, ...DEFAULT_SIZES]) {
    if (!rest.some((v) => v.name === def.name) && !colors.some((v) => v.name === def.name)) {
      rest.push(def);
    }
  }
  // Any other leftover vars from imported CSS
  for (const v of byName.values()) {
    if (!THEME_COLOR_SCHEMA.some((t) => t.name === v.name)) {
      rest.push(v);
    }
  }

  return [...colors, ...rest];
}

export function getEditableSizeVariables(variables: ThemeVariable[]): ThemeVariable[] {
  const byName = new Map(variables.map((v) => [v.name, v]));
  return THEME_SIZE_SCHEMA.map((token) => {
    const existing = byName.get(token.name);
    if (existing) return { ...existing, type: "size" as const };
    const fallback = DEFAULT_SIZES.find((d) => d.name === token.name);
    return {
      name: token.name,
      value: fallback?.value ?? "0px",
      type: "size" as const,
    };
  });
}

export function getSizeTokenMeta(name: string): ThemeSizeToken | undefined {
  return THEME_SIZE_SCHEMA.find((t) => t.name === name);
}

export function getToggleTokenMeta(name: string): ThemeToggleToken | undefined {
  return THEME_TOGGLE_SCHEMA.find((t) => t.name === name);
}

export function getEditableColorVariables(variables: ThemeVariable[]): ThemeVariable[] {
  const hidden = new Set(
    THEME_COLOR_SCHEMA.filter((t) => t.hidden).map((t) => t.name),
  );
  const schemaNames = new Set(THEME_COLOR_SCHEMA.map((t) => t.name));
  return variables.filter((v) => schemaNames.has(v.name) && !hidden.has(v.name));
}

/** 按编辑器元素分组，颜色与尺寸字段穿插在同一 section 内 */
export function buildThemeEditorSections(variables: ThemeVariable[]): ThemeEditorSectionView[] {
  const byName = new Map(variables.map((v) => [v.name, v]));

  const resolveColor = (token: ThemeColorToken): ThemeVariable => {
    const existing = byName.get(token.name);
    if (existing) return { ...existing, type: "color" };
    if (token.name === "--tree-indent-hint-color") {
      const border = byName.get("--border");
      return {
        name: token.name,
        value: border?.value ?? LIGHT_DEFAULTS["--border"] ?? "#45475a",
        type: "color",
      };
    }
    if (token.name === "--library-volume-bg") {
      const primary = byName.get("--bg-primary");
      return {
        name: token.name,
        value:
          LIGHT_DEFAULTS[token.name] ??
          primary?.value ??
          LIGHT_DEFAULTS["--bg-primary"] ??
          "#ffffff",
        type: "color",
      };
    }
    if (token.name === "--library-chapter-bg") {
      return {
        name: token.name,
        value: LIGHT_DEFAULTS[token.name] ?? "transparent",
        type: "color",
      };
    }
    if (token.name === "--library-chapter-preview" || token.name === "--library-chapter-meta") {
      const tertiary = byName.get("--text-tertiary");
      return {
        name: token.name,
        value:
          LIGHT_DEFAULTS[token.name] ??
          tertiary?.value ??
          LIGHT_DEFAULTS["--text-tertiary"] ??
          "#94a3b8",
        type: "color",
      };
    }
    return {
      name: token.name,
      value: LIGHT_DEFAULTS[token.name] ?? "#ffffff",
      type: "color",
    };
  };

  const resolveSize = (token: ThemeSizeToken): ThemeVariable => {
    const existing = byName.get(token.name);
    if (existing) return { ...existing, type: "size" };
    const fallback = DEFAULT_SIZES.find((d) => d.name === token.name);
    return {
      name: token.name,
      value: fallback?.value ?? "0px",
      type: "size",
    };
  };

  const resolveToggle = (token: ThemeToggleToken): ThemeVariable => {
    const existing = byName.get(token.name);
    if (existing) return { ...existing, type: "size" };
    const fallback = DEFAULT_SIZES.find((d) => d.name === token.name);
    return {
      name: token.name,
      value: fallback?.value ?? "1",
      type: "size",
    };
  };

  const sections = filterEditorSectionsByProfile(THEME_EDITOR_SECTIONS);
  const profile = tryGetThemeConfig()?.editorProfile ?? "full";

  return sections.map((section) => {
    const fields: ThemeEditorField[] = [];

    for (const token of THEME_COLOR_SCHEMA) {
      if (token.hidden || token.section !== section.id) continue;
      if (!isTokenVisibleForProfile(token, profile)) continue;
      fields.push({ kind: "color", variable: resolveColor(token), meta: token });
    }
    for (const token of THEME_SIZE_SCHEMA) {
      if (token.section !== section.id) continue;
      if (!isTokenVisibleForProfile(token, profile)) continue;
      fields.push({ kind: "size", variable: resolveSize(token), meta: token });
    }
    for (const token of THEME_TOGGLE_SCHEMA) {
      if (token.section !== section.id) continue;
      if (!isTokenVisibleForProfile(token, profile)) continue;
      fields.push({ kind: "toggle", variable: resolveToggle(token), meta: token });
    }

    const ordered =
      profile === "chrome" && section.id === "chrome"
        ? sortChromeInterfaceFields(fields)
        : fields;

    return {
      id: section.id,
      titleKey: section.titleKey,
      fields: ordered,
    };
  }).filter((s) => s.fields.length > 0);
}

/** @deprecated 使用 buildThemeEditorSections */
export function groupEditableColors(
  variables: ThemeVariable[],
): Record<ThemeEditorSectionId, ThemeVariable[]> {
  const sections = buildThemeEditorSections(variables);
  const result = Object.fromEntries(
    THEME_EDITOR_SECTIONS.map((s) => [s.id, [] as ThemeVariable[]]),
  ) as Record<ThemeEditorSectionId, ThemeVariable[]>;
  for (const section of sections) {
    result[section.id] = section.fields
      .filter((f) => f.kind === "color")
      .map((f) => f.variable);
  }
  return result;
}

export function getTokenMeta(name: string): ThemeColorToken | undefined {
  return THEME_COLOR_SCHEMA.find((t) => t.name === name);
}

