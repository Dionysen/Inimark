export const BUILTIN_THEMES = [
  "light",
  "grey",
  "slate",
  "claude-code",
  "mint",
  "purple",
  "hermes",
  "ocean",
  "dark-modern",
  "cursor",
  "dracula",
] as const;

export type BuiltinThemeName = (typeof BUILTIN_THEMES)[number];

/** Default dark builtin (successor of the removed `dark` theme). */
export const DEFAULT_DARK_BUILTIN: BuiltinThemeName = "ocean";

/** Old ids → current ids (kept for localStorage / preferred-theme migration). */
const LEGACY_THEME_IDS: Record<string, BuiltinThemeName> = {
  white: "light",
  dark: "ocean",
  "modern-dark": "dark-modern",
  "mint-dark": "ocean",
  next: "mint",
  // Promoted customs → builtins
  "custom-er44d9pe": "ocean",
  "custom-vz8ojnvc": "dark-modern",
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
  const mapped = LEGACY_THEME_IDS[id];
  if (mapped) return mapped;
  if (isBuiltinTheme(id) || isCustomTheme(id)) return id;
  return fallback;
}
