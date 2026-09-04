export const BUILTIN_THEMES = ["light", "grey", "dark"] as const;

export type BuiltinThemeName = (typeof BUILTIN_THEMES)[number];

/** Old ids → current ids (kept for localStorage / preferred-theme migration). */
const LEGACY_THEME_IDS: Record<string, BuiltinThemeName> = {
  white: "light",
  slate: "grey",
  "modern-dark": "dark",
  mint: "light",
  "mint-dark": "dark",
  "claude-code": "light",
  purple: "light",
  hermes: "light",
  next: "light",
  ocean: "light",
};

export function isBuiltinTheme(theme: string): theme is BuiltinThemeName {
  return (BUILTIN_THEMES as readonly string[]).includes(theme);
}

export function isCustomTheme(theme: string): boolean {
  return theme.startsWith("custom-");
}

export function getThemeIdFromCustom(customTheme: string): string | null {
  if (!customTheme.startsWith("custom-")) return null;
  return customTheme.replace("custom-", "");
}

/** Map a stored theme id onto a current builtin, or leave custom/unknown as-is. */
export function normalizeAppThemeId(id: string, fallback: BuiltinThemeName): string {
  if (isBuiltinTheme(id) || isCustomTheme(id)) return id;
  const mapped = LEGACY_THEME_IDS[id];
  if (mapped) return mapped;
  return fallback;
}
