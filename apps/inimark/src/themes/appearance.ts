import { CODE_THEMES } from "./code-themes.ts";
import {
  type AppearanceMode,
  type ResolvedAppearance,
  type ThemePair,
  DEFAULT_APP_THEME_PAIR,
  BUILTIN_THEME_IS_DARK,
  getSystemIsDark,
  resolveAppearanceMode,
  resolveActiveFromPair,
  isBuiltinAppThemeDark,
  inferThemeIdIsDark,
  withPreferredApp,
  loadAppearanceState as loadAppAppearanceState,
  persistAppearanceState as persistAppAppearanceState,
  type AppearanceState as AppAppearanceState,
} from "@dionysen/theme";

export type { AppearanceMode, ResolvedAppearance, ThemePair };
export {
  DEFAULT_APP_THEME_PAIR,
  BUILTIN_THEME_IS_DARK,
  getSystemIsDark,
  resolveAppearanceMode,
  resolveActiveFromPair,
  isBuiltinAppThemeDark,
  inferThemeIdIsDark,
  withPreferredApp,
};

export interface AppearanceState {
  appearanceMode: AppearanceMode;
  preferredAppTheme: ThemePair;
  preferredCodeTheme: ThemePair;
}

export const DEFAULT_CODE_THEME_PAIR: ThemePair = {
  light: "github-light",
  dark: "github-dark",
};

export const APPEARANCE_MODE_KEY = "inimark-appearance-mode";
export const PREFERRED_APP_THEME_KEY = "inimark-preferred-app-theme";
export const PREFERRED_CODE_THEME_KEY = "inimark-preferred-code-theme";
export const LEGACY_THEME_KEY = "inimark-theme";
export const LEGACY_CODE_THEME_KEY = "inimark-code-theme";
export const APPEARANCE_SYNC_EVENT = "appearance-state-changed";
export const THEME_CATALOG_SYNC_EVENT = "theme-catalog-changed";

export function isBuiltinCodeThemeDark(id: string): boolean | null {
  const found = CODE_THEMES.find((t) => t.id === id);
  return found ? found.isDark : null;
}

export function inferCodeThemeIdIsDark(
  id: string,
  customIsDark?: boolean | null,
): boolean {
  if (id === "auto") return false;
  const builtin = isBuiltinCodeThemeDark(id);
  if (builtin != null) return builtin;
  if (typeof customIsDark === "boolean") return customIsDark;
  return /dark/i.test(id);
}

function parsePair(raw: string | null, fallback: ThemePair): ThemePair {
  if (!raw) return { ...fallback };
  try {
    const parsed = JSON.parse(raw) as Partial<ThemePair>;
    return {
      light: typeof parsed.light === "string" && parsed.light ? parsed.light : fallback.light,
      dark: typeof parsed.dark === "string" && parsed.dark ? parsed.dark : fallback.dark,
    };
  } catch {
    return { ...fallback };
  }
}

/** Load appearance including preferred code theme (Inimark-only). */
export function loadAppearanceState(): AppearanceState {
  const app = loadAppAppearanceState();
  let preferredCodeTheme = parsePair(
    localStorage.getItem(PREFERRED_CODE_THEME_KEY),
    DEFAULT_CODE_THEME_PAIR,
  );

  // Migrate legacy code theme key once when preferred pair is still default
  const legacyCode = localStorage.getItem(LEGACY_CODE_THEME_KEY);
  if (
    legacyCode &&
    legacyCode !== "auto" &&
    preferredCodeTheme.light === DEFAULT_CODE_THEME_PAIR.light &&
    preferredCodeTheme.dark === DEFAULT_CODE_THEME_PAIR.dark
  ) {
    preferredCodeTheme = { ...DEFAULT_CODE_THEME_PAIR };
    if (inferCodeThemeIdIsDark(legacyCode)) {
      preferredCodeTheme.dark = legacyCode;
    } else {
      preferredCodeTheme.light = legacyCode;
    }
  }

  const state: AppearanceState = {
    appearanceMode: app.appearanceMode,
    preferredAppTheme: app.preferredAppTheme,
    preferredCodeTheme,
  };
  persistAppearanceState(state);
  return state;
}

export function persistAppearanceState(state: AppearanceState): void {
  const appOnly: AppAppearanceState = {
    appearanceMode: state.appearanceMode,
    preferredAppTheme: state.preferredAppTheme,
  };
  persistAppAppearanceState(appOnly);
  try {
    localStorage.setItem(PREFERRED_CODE_THEME_KEY, JSON.stringify(state.preferredCodeTheme));
    const resolved = resolveAppearanceMode(state.appearanceMode);
    localStorage.setItem(
      LEGACY_CODE_THEME_KEY,
      resolveActiveFromPair(state.preferredCodeTheme, resolved),
    );
  } catch {
    /* ignore */
  }
}

export function withPreferredCode(
  pair: ThemePair,
  mode: ResolvedAppearance,
  id: string,
): ThemePair {
  return mode === "dark" ? { ...pair, dark: id } : { ...pair, light: id };
}
