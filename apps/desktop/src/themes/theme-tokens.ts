import type { ThemeVariable } from "./custom-theme-manager.ts";
import type { BuiltinThemeName } from "./builtin.ts";
import { BUILTIN_THEMES } from "./builtin.ts";

/** 主题编辑器分组：按编辑器/界面元素分类 */
export type ThemeEditorSectionId =
  | "chrome"
  | "body"
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
}

export interface ThemeToggleToken {
  name: string;
  section: ThemeEditorSectionId;
  labelKey: string;
}

export interface ThemeEditorSectionDef {
  id: ThemeEditorSectionId;
  /** i18n key under settings.theme.* */
  titleKey: string;
}

/** 编辑器 UI 分组顺序 */
export const THEME_EDITOR_SECTIONS: ThemeEditorSectionDef[] = [
  { id: "chrome", titleKey: "groupChrome" },
  { id: "body", titleKey: "groupBody" },
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
  // 界面
  { name: "--bg-secondary", section: "chrome", labelKey: "bgSecondary" },
  { name: "--bg-surface", section: "chrome", labelKey: "bgSurface" },
  { name: "--bg-hover", section: "chrome", labelKey: "bgHover" },
  { name: "--bg-tertiary", section: "chrome", labelKey: "bgTertiary" },
  { name: "--bg-input", section: "chrome", labelKey: "bgInput" },
  { name: "--border", section: "chrome", labelKey: "border" },
  { name: "--accent", section: "chrome", labelKey: "accent" },
  { name: "--accent-hover", section: "chrome", labelKey: "accentHover" },
  { name: "--accent-rgb", section: "chrome", labelKey: "accentRgb", hidden: true },
  { name: "--danger", section: "chrome", labelKey: "danger" },
  { name: "--tree-indent-hint-color", section: "chrome", labelKey: "treeIndentHintColor" },
  // 正文
  { name: "--bg-primary", section: "body", labelKey: "bgPrimary" },
  { name: "--text-primary", section: "body", labelKey: "textPrimary" },
  { name: "--text-secondary", section: "body", labelKey: "textSecondary" },
  { name: "--text-tertiary", section: "body", labelKey: "textTertiary" },
  { name: "--text-strong", section: "body", labelKey: "textStrong" },
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
  { name: "--radius-control", section: "chrome", labelKey: "radiusControl", min: 0, max: 16 },
  { name: "--control-height", section: "chrome", labelKey: "controlHeight", min: 24, max: 44 },
  { name: "--control-padding-x", section: "chrome", labelKey: "controlPaddingX", min: 4, max: 24 },
  { name: "--control-font-size", section: "chrome", labelKey: "controlFontSize", min: 11, max: 18 },
  { name: "--menu-item-padding-y", section: "chrome", labelKey: "menuItemPaddingY", min: 2, max: 16 },
  { name: "--tree-item-padding-y", section: "chrome", labelKey: "treeItemPaddingY", min: 2, max: 16 },
  { name: "--tree-indent-hint-width", section: "chrome", labelKey: "treeIndentHintWidth", min: 1, max: 4 },
  { name: "--tree-indent-hint-size", section: "chrome", labelKey: "treeIndentHintSize", min: 8, max: 28 },
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
    section: "chrome",
    labelKey: "treeIndentHintVisible",
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
  "--bg-secondary": "#f5f7fa",
  "--bg-surface": "#f1f5f9",
  "--bg-hover": "rgba(0, 0, 0, 0.06)",
  "--bg-tertiary": "#e8ecf1",
  "--bg-code": "#f6f8fa",
  "--bg-code-inline": "rgba(0, 0, 0, 0.06)",
  "--bg-input": "#ffffff",
  "--text-primary": "#1e293b",
  "--text-secondary": "#64748b",
  "--text-tertiary": "#94a3b8",
  "--text-strong": "#bd387d",
  "--text-code": "#e83e8c",
  "--accent": "#2563eb",
  "--accent-rgb": "37, 99, 235",
  "--accent-hover": "#1d4ed8",
  "--danger": "#dc2626",
  "--border": "#d1d9e6",
  "--code-inline-border": "#d1d9e6",
  "--scrollbar-thumb": "#d1d9e6",
  "--scrollbar-thumb-hover": "#94a3b8",
  "--scrollbar-track": "transparent",
  "--metadata-bg": "#f6f8fa",
  "--metadata-border": "#d1d9e6",
  "--blockquote-border": "#d1d9e6",
  "--blockquote-bg": "transparent",
  "--blockquote-text": "#64748b",
  "--table-header-bg": "#f5f7fa",
  "--table-cell-bg": "transparent",
  "--tag-bg": "rgba(37, 99, 235, 0.15)",
  "--tag-text": "#2563eb",
  "--tag-border": "rgba(37, 99, 235, 0.2)",
};

const DARK_DEFAULTS: Record<string, string> = {
  "--bg-primary": "#1b1d24",
  "--bg-secondary": "#111217",
  "--bg-surface": "#1b1d24",
  "--bg-hover": "rgba(255, 255, 255, 0.08)",
  "--bg-tertiary": "#1e1e6c",
  "--bg-code": "#1f2129",
  "--bg-code-inline": "#181a21",
  "--bg-input": "#272729",
  "--text-primary": "#cccccc",
  "--text-secondary": "#818286",
  "--text-tertiary": "#5c5e63",
  "--text-strong": "#ffffff",
  "--text-code": "#ebebeb",
  "--accent": "#74a7fe",
  "--accent-rgb": "116, 167, 254",
  "--accent-hover": "#3a88fe",
  "--danger": "#e06c75",
  "--border": "rgba(145, 145, 145, 0.159)",
  "--code-inline-border": "rgba(145, 145, 145, 0.159)",
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
};

/** Full color maps for each built-in theme (for fork). Keep in sync with themes.css. */
export const BUILTIN_THEME_COLORS: Record<BuiltinThemeName, Record<string, string>> = {
  light: {
    "--bg-primary": "#ffffff",
    "--bg-secondary": "#f5f7fa",
    "--bg-surface": "#f1f5f9",
    "--bg-hover": "rgba(0, 0, 0, 0.06)",
    "--bg-tertiary": "#e8ecf1",
    "--bg-code": "#f6f8fa",
    "--bg-code-inline": "rgba(0, 0, 0, 0.06)",
    "--bg-input": "#ffffff",
    "--text-primary": "#1e293b",
    "--text-secondary": "#64748b",
    "--text-tertiary": "#94a3b8",
    "--text-strong": "#bd387d",
    "--text-code": "#e83e8c",
    "--accent": "#2563eb",
    "--accent-rgb": "37, 99, 235",
    "--accent-hover": "#1d4ed8",
    "--danger": "#dc2626",
    "--border": "#d1d9e6",
  },
  grey: {
    "--bg-primary": "#f8fafc",
    "--bg-secondary": "#f1f5f9",
    "--bg-surface": "#f8fafc",
    "--bg-hover": "rgba(71, 85, 105, 0.08)",
    "--bg-tertiary": "#e2e8f0",
    "--bg-code": "#f1f5f9",
    "--bg-code-inline": "rgba(100, 116, 139, 0.08)",
    "--bg-input": "#f8fafc",
    "--text-primary": "#0f172a",
    "--text-secondary": "#64748b",
    "--text-tertiary": "#94a3b8",
    "--text-strong": "#bd387d",
    "--text-code": "#e83e8c",
    "--accent": "#475569",
    "--accent-rgb": "71, 85, 105",
    "--accent-hover": "#334155",
    "--danger": "#dc2626",
    "--border": "#e2e8f0",
  },
  dark: {
    "--bg-primary": "#1b1d24",
    "--bg-secondary": "#111217",
    "--bg-surface": "#1b1d24",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--bg-tertiary": "#1e1e6c",
    "--bg-code": "#1f2129",
    "--bg-code-inline": "#181a21",
    "--bg-input": "#272729",
    "--text-primary": "#cccccc",
    "--text-secondary": "#818286",
    "--text-tertiary": "#5c5e63",
    "--text-strong": "#ffffff",
    "--text-code": "#ebebeb",
    "--accent": "#74a7fe",
    "--accent-rgb": "116, 167, 254",
    "--accent-hover": "#3a88fe",
    "--danger": "#e06c75",
    "--border": "rgba(145, 145, 145, 0.159)",
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
    "--scrollbar-thumb-hover": "#6B6B6B",
    "--scrollbar-track": "transparent",
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
  { name: "--sidebar-chrome-opacity", value: "1", type: "size" },
  { name: "--radius-control", value: "6px", type: "size" },
  { name: "--control-height", value: "32px", type: "size" },
  { name: "--control-padding-x", value: "10px", type: "size" },
  { name: "--control-font-size", value: "13px", type: "size" },
  { name: "--menu-item-padding-y", value: "6px", type: "size" },
  { name: "--tree-item-padding-y", value: "5px", type: "size" },
  { name: "--tree-indent-hint-width", value: "1px", type: "size" },
  { name: "--tree-indent-hint-size", value: "14px", type: "size" },
  { name: "--tree-indent-hint-visible", value: "1", type: "size" },
  { name: "--radius-code-block", value: "8px", type: "size" },
  { name: "--radius-code-inline", value: "4px", type: "size" },
  { name: "--padding-code-inline-y", value: "3px", type: "size" },
  { name: "--padding-code-inline-x", value: "6px", type: "size" },
  { name: "--code-inline-border-width", value: "1px", type: "size" },
  { name: "--radius-metadata", value: "8px", type: "size" },
  { name: "--margin-metadata-bottom", value: "16px", type: "size" },
  { name: "--blockquote-border-width", value: "3px", type: "size" },
  { name: "--padding-blockquote-y", value: "4px", type: "size" },
  { name: "--padding-blockquote-x", value: "16px", type: "size" },
  { name: "--radius-table", value: "0px", type: "size" },
  { name: "--radius-tag", value: "10px", type: "size" },
  { name: "--padding-tag-y", value: "1px", type: "size" },
  { name: "--padding-tag-x", value: "8px", type: "size" },
  { name: "--radius-scrollbar", value: "4px", type: "size" },
  { name: "--scrollbar-size", value: "8px", type: "size" },
];

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
  return [...colorMapToVariables(colors), ...DEFAULT_FONTS, ...DEFAULT_SIZES];
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

  return THEME_EDITOR_SECTIONS.map((section) => {
    const fields: ThemeEditorField[] = [];

    for (const token of THEME_COLOR_SCHEMA) {
      if (token.hidden || token.section !== section.id) continue;
      fields.push({ kind: "color", variable: resolveColor(token), meta: token });
    }
    for (const token of THEME_SIZE_SCHEMA) {
      if (token.section !== section.id) continue;
      fields.push({ kind: "size", variable: resolveSize(token), meta: token });
    }
    for (const token of THEME_TOGGLE_SCHEMA) {
      if (token.section !== section.id) continue;
      fields.push({ kind: "toggle", variable: resolveToggle(token), meta: token });
    }

    return {
      id: section.id,
      titleKey: section.titleKey,
      fields,
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
