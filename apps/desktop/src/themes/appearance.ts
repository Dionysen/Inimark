import { CODE_THEMES } from "./code-themes.ts";
import {
  BUILTIN_THEMES,
  normalizeAppThemeId,
  type BuiltinThemeName,
} from "./builtin.ts";

export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedAppearance = "light" | "dark";

export interface ThemePair {
  light: string;
  dark: string;
}

export interface AppearanceState {
  appearanceMode: AppearanceMode;
  preferredAppTheme: ThemePair;
  preferredCodeTheme: ThemePair;
}

export const DEFAULT_APP_THEME_PAIR: ThemePair = {
  light: "light",
  dark: "dark",
};

export const DEFAULT_CODE_THEME_PAIR: ThemePair = {
  light: "github-light",
  dark: "github-dark",
};

/** Catalog hint for built-in themes (preview / legacy migration only — not used for selection). */
export const BUILTIN_THEME_IS_DARK: Record<BuiltinThemeName, boolean> = {
  light: false,
  grey: false,
  dark: true,
};

export const APPEARANCE_MODE_KEY = "inimark-appearance-mode";
export const PREFERRED_APP_THEME_KEY = "inimark-preferred-app-theme";
export const PREFERRED_CODE_THEME_KEY = "inimark-preferred-code-theme";
/** Legacy single-theme keys (still written as resolved active ids). */
export const LEGACY_THEME_KEY = "inimark-theme";
export const LEGACY_CODE_THEME_KEY = "inimark-code-theme";

export const APPEARANCE_SYNC_EVENT = "appearance-state-changed";

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

export function isBuiltinCodeThemeDark(id: string): boolean | null {
  const found = CODE_THEMES.find((t) => t.id === id);
  return found ? found.isDark : null;
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

/** Load appearance state, migrating legacy single-theme keys once. */
export function loadAppearanceState(): AppearanceState {
  try {
    const existingMode = parseMode(localStorage.getItem(APPEARANCE_MODE_KEY));
    if (existingMode) {
      const state: AppearanceState = {
        appearanceMode: existingMode,
        preferredAppTheme: parseAppThemePair(
          localStorage.getItem(PREFERRED_APP_THEME_KEY),
          DEFAULT_APP_THEME_PAIR,
        ),
        preferredCodeTheme: parsePair(
          localStorage.getItem(PREFERRED_CODE_THEME_KEY),
          DEFAULT_CODE_THEME_PAIR,
        ),
      };
      persistAppearanceState(state);
      return state;
    }

    // ── Migrate from legacy keys ──
    const oldThemeRaw = localStorage.getItem(LEGACY_THEME_KEY) || DEFAULT_APP_THEME_PAIR.light;
    const oldTheme = normalizeAppThemeId(oldThemeRaw, "light");
    const oldCode = localStorage.getItem(LEGACY_CODE_THEME_KEY) || "auto";
    const oldAppDark = inferThemeIdIsDark(oldTheme);

    const preferredAppTheme: ThemePair = {
      light: oldAppDark ? DEFAULT_APP_THEME_PAIR.light : oldTheme,
      dark: oldAppDark ? oldTheme : DEFAULT_APP_THEME_PAIR.dark,
    };

    const preferredCodeTheme: ThemePair = { ...DEFAULT_CODE_THEME_PAIR };
    if (oldCode && oldCode !== "auto") {
      if (inferCodeThemeIdIsDark(oldCode)) {
        preferredCodeTheme.dark = oldCode;
      } else {
        preferredCodeTheme.light = oldCode;
      }
    }

    // Preserve current look (don't suddenly jump to system)
    const appearanceMode: AppearanceMode = oldAppDark ? "dark" : "light";

    const state: AppearanceState = {
      appearanceMode,
      preferredAppTheme,
      preferredCodeTheme,
    };
    persistAppearanceState(state);
    return state;
  } catch {
    return {
      appearanceMode: "system",
      preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
      preferredCodeTheme: { ...DEFAULT_CODE_THEME_PAIR },
    };
  }
}

export function persistAppearanceState(state: AppearanceState): void {
  try {
    localStorage.setItem(APPEARANCE_MODE_KEY, state.appearanceMode);
    localStorage.setItem(PREFERRED_APP_THEME_KEY, JSON.stringify(state.preferredAppTheme));
    localStorage.setItem(PREFERRED_CODE_THEME_KEY, JSON.stringify(state.preferredCodeTheme));

    const resolved = resolveAppearanceMode(state.appearanceMode);
    localStorage.setItem(
      LEGACY_THEME_KEY,
      resolveActiveFromPair(state.preferredAppTheme, resolved),
    );
    localStorage.setItem(
      LEGACY_CODE_THEME_KEY,
      resolveActiveFromPair(state.preferredCodeTheme, resolved),
    );
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

export function withPreferredCode(
  pair: ThemePair,
  mode: ResolvedAppearance,
  id: string,
): ThemePair {
  return mode === "dark" ? { ...pair, dark: id } : { ...pair, light: id };
}
