import {
  normalizeAppThemeId,
  type BuiltinThemeName,
  BUILTIN_THEMES,
} from "./builtin.ts";
import { getThemeConfig, tryGetThemeConfig } from "./config.ts";

export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedAppearance = "light" | "dark";

export interface ThemePair {
  light: string;
  dark: string;
}

/** App-only appearance (code themes stay in product apps). */
export interface AppearanceState {
  appearanceMode: AppearanceMode;
  preferredAppTheme: ThemePair;
}

export const DEFAULT_APP_THEME_PAIR: ThemePair = {
  light: "light",
  dark: "ocean",
};

/** Catalog hint for built-in themes (preview / legacy migration only). */
export const BUILTIN_THEME_IS_DARK: Record<BuiltinThemeName, boolean> = {
  light: false,
  grey: false,
  slate: false,
  "claude-code": false,
  mint: false,
  purple: false,
  hermes: false,
  ocean: true,
  "dark-modern": true,
  cursor: true,
  dracula: true,
};

/** @deprecated Use getThemeConfig().storageKeys — kept for Inimark re-export compat. */
export const APPEARANCE_MODE_KEY = "inimark-appearance-mode";
/** @deprecated Use getThemeConfig().storageKeys */
export const PREFERRED_APP_THEME_KEY = "inimark-preferred-app-theme";
/** @deprecated Use getThemeConfig().storageKeys.legacyAppTheme */
export const LEGACY_THEME_KEY = "inimark-theme";
/** @deprecated Use getThemeConfig().syncEvents.appearance */
export const APPEARANCE_SYNC_EVENT = "appearance-state-changed";
/** @deprecated Use getThemeConfig().syncEvents.catalog */
export const THEME_CATALOG_SYNC_EVENT = "theme-catalog-changed";

export function getSystemIsDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveAppearanceMode(
  mode: AppearanceMode,
  systemIsDark: boolean = getSystemIsDark(),
): ResolvedAppearance {
  if (mode === "system") return systemIsDark ? "dark" : "light";
  return mode;
}

export function resolveActiveFromPair(
  pair: ThemePair,
  resolved: ResolvedAppearance,
): string {
  return resolved === "dark" ? pair.dark : pair.light;
}

export function isBuiltinAppThemeDark(id: string): boolean | null {
  if ((BUILTIN_THEMES as readonly string[]).includes(id)) {
    return BUILTIN_THEME_IS_DARK[id as BuiltinThemeName];
  }
  return null;
}

/** Best-effort darkness for any theme id (builtins / custom / legacy). */
export function inferThemeIdIsDark(
  id: string,
  customIsDark?: boolean | null,
): boolean {
  const builtin = isBuiltinAppThemeDark(id);
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

function parseAppThemePair(raw: string | null, fallback: ThemePair): ThemePair {
  const pair = parsePair(raw, fallback);
  return {
    light: normalizeAppThemeId(pair.light, fallback.light as BuiltinThemeName),
    dark: normalizeAppThemeId(pair.dark, fallback.dark as BuiltinThemeName),
  };
}

function parseMode(raw: string | null): AppearanceMode | null {
  if (raw === "system" || raw === "light" || raw === "dark") return raw;
  return null;
}

function keys() {
  const cfg = getThemeConfig();
  return cfg.storageKeys;
}

function defaults() {
  const cfg = tryGetThemeConfig();
  return {
    appearanceMode: cfg?.defaults.appearanceMode ?? ("system" as AppearanceMode),
    preferredAppTheme: cfg?.defaults.preferredAppTheme ?? DEFAULT_APP_THEME_PAIR,
  };
}

/** Load appearance state, migrating legacy single-theme keys once. */
export function loadAppearanceState(): AppearanceState {
  const d = defaults();
  try {
    const { appearanceMode: modeKey, preferredAppTheme: pairKey, legacyAppTheme } = keys();
    const existingMode = parseMode(localStorage.getItem(modeKey));
    if (existingMode) {
      const state: AppearanceState = {
        appearanceMode: existingMode,
        preferredAppTheme: parseAppThemePair(
          localStorage.getItem(pairKey),
          d.preferredAppTheme,
        ),
      };
      persistAppearanceState(state);
      return state;
    }

    const oldThemeRaw =
      (legacyAppTheme ? localStorage.getItem(legacyAppTheme) : null) ||
      d.preferredAppTheme.light;
    const oldTheme = normalizeAppThemeId(oldThemeRaw, "light");
    const oldAppDark = inferThemeIdIsDark(oldTheme);

    const preferredAppTheme: ThemePair = {
      light: oldAppDark ? d.preferredAppTheme.light : oldTheme,
      dark: oldAppDark ? oldTheme : d.preferredAppTheme.dark,
    };

    const appearanceMode: AppearanceMode = oldAppDark ? "dark" : "light";
    const state: AppearanceState = { appearanceMode, preferredAppTheme };
    persistAppearanceState(state);
    return state;
  } catch {
    return {
      appearanceMode: d.appearanceMode,
      preferredAppTheme: { ...d.preferredAppTheme },
    };
  }
}

export function persistAppearanceState(state: AppearanceState): void {
  try {
    const { appearanceMode: modeKey, preferredAppTheme: pairKey, legacyAppTheme } = keys();
    localStorage.setItem(modeKey, state.appearanceMode);
    localStorage.setItem(pairKey, JSON.stringify(state.preferredAppTheme));

    if (legacyAppTheme) {
      const resolved = resolveAppearanceMode(state.appearanceMode);
      localStorage.setItem(
        legacyAppTheme,
        resolveActiveFromPair(state.preferredAppTheme, resolved),
      );
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function withPreferredApp(
  pair: ThemePair,
  mode: ResolvedAppearance,
  id: string,
): ThemePair {
  return mode === "dark" ? { ...pair, dark: id } : { ...pair, light: id };
}
