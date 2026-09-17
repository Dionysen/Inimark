import { emit, listen } from "@tauri-apps/api/event";
import {
  type AppearanceMode,
  type AppearanceState,
  type ResolvedAppearance,
  type ThemePair,
  getSystemIsDark,
  inferThemeIdIsDark,
  loadAppearanceState,
  persistAppearanceState,
  resolveActiveFromPair,
  resolveAppearanceMode,
  withPreferredApp,
  DEFAULT_APP_THEME_PAIR,
} from "./appearance.ts";
import { isBuiltinTheme } from "./builtin.ts";
import { getThemeConfig } from "./config.ts";
import {
  buildThemeCss,
  createThemeFromVariables,
  deleteTheme as deleteThemeFs,
  extractPreviewColors,
  getCustomThemeCss,
  importTheme as importThemeFs,
  inferAppThemeIsDark,
  loadManifest,
  parseCssVariables,
  persistThemeVariables,
  renameTheme as renameThemeFs,
  type ThemeManifest,
  type ThemeVariable,
} from "./theme-store.ts";
import {
  buildThemePack,
  exportCustomAppTheme,
  exportThemePackToFile,
  importSelectedAppThemes,
  type ThemePack,
  type ThemePackAppImportResult,
} from "./theme-pack.ts";
import { getBuiltinThemeVariables, getTemplateVariables } from "./theme-tokens.ts";

export type ThemeName = string;

type ThemeCssPayload = { id: string; css: string; enable: boolean };
type Listener = () => void;

export interface AppThemeManagerSnapshot {
  appearanceMode: AppearanceMode;
  resolvedMode: ResolvedAppearance;
  theme: ThemeName;
  preferredAppTheme: ThemePair;
  customThemes: ThemeManifest[];
}

/**
 * Chrome-scoped theme manager: appearance mode + app theme pair + custom CSS themes.
 * Code themes are handled by product apps (e.g. Inimark).
 */
class AppThemeManager {
  private state: AppearanceState;
  private systemIsDark = getSystemIsDark();
  private customThemes: ThemeManifest[] = [];
  private styleElements = new Map<string, HTMLStyleElement>();
  private listeners = new Set<Listener>();
  private mediaQuery: MediaQueryList | null = null;
  private unlistenAppearance: (() => void) | undefined;
  private unlistenCatalog: (() => void) | undefined;
  private unlistenCss: (() => void) | undefined;
  private initialized = false;
  private onSystemChange: (() => void) | null = null;

  constructor() {
    this.state = loadAppearanceState();
  }

  getSnapshot(): AppThemeManagerSnapshot {
    const resolvedMode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    return {
      appearanceMode: this.state.appearanceMode,
      resolvedMode,
      theme: resolveActiveFromPair(this.state.preferredAppTheme, resolvedMode),
      preferredAppTheme: { ...this.state.preferredAppTheme },
      customThemes: [...this.customThemes],
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private emitCatalogSync(): void {
    const { catalog } = getThemeConfig().syncEvents;
    emit(catalog, null).catch(() => {});
  }

  private patchState(patch: Partial<AppearanceState>): void {
    this.state = {
      appearanceMode: patch.appearanceMode ?? this.state.appearanceMode,
      preferredAppTheme: patch.preferredAppTheme ?? this.state.preferredAppTheme,
    };
    persistAppearanceState(this.state);
    this.applyThemes();
    const { appearance } = getThemeConfig().syncEvents;
    emit(appearance, this.state).catch(() => {});
    this.notify();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const events = getThemeConfig().syncEvents;

    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.onSystemChange = () => {
      this.systemIsDark = this.mediaQuery?.matches ?? false;
      this.applyThemes();
      this.notify();
    };
    this.onSystemChange();
    this.mediaQuery.addEventListener("change", this.onSystemChange);

    this.unlistenAppearance = await listen<AppearanceState>(events.appearance, async (event) => {
      const next = event.payload;
      if (!next) return;
      this.state = next;
      persistAppearanceState(next);
      await this.ensureCustomStylesForActive();
      this.applyThemes();
      this.notify();
    });

    this.unlistenCatalog = await listen(events.catalog, async () => {
      await this.refreshCustomThemes();
      await this.ensureCustomStylesForActive();
      this.applyThemes();
    });

    this.unlistenCss = await listen<ThemeCssPayload>(events.themeCss, (event) => {
      const { id, css, enable } = event.payload;
      this.injectOrUpdateStyle(id, css, enable);
    });

    setTimeout(() => {
      void this.refreshCustomThemes();
    }, 300);

    this.applyThemes();
  }

  destroy(): void {
    if (this.mediaQuery && this.onSystemChange) {
      this.mediaQuery.removeEventListener("change", this.onSystemChange);
    }
    this.unlistenAppearance?.();
    this.unlistenCatalog?.();
    this.unlistenCss?.();
    this.listeners.clear();
  }

  setAppearanceMode(mode: AppearanceMode): void {
    this.patchState({ appearanceMode: mode });
  }

  setPreferredAppTheme(mode: ResolvedAppearance, id: string): void {
    this.patchState({
      preferredAppTheme: withPreferredApp(this.state.preferredAppTheme, mode, id),
    });
  }

  setTheme(id: ThemeName): void {
    const mode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    this.patchState({
      preferredAppTheme: withPreferredApp(this.state.preferredAppTheme, mode, id),
    });
  }

  getAppThemeIsDark(id: string): boolean {
    if (id.startsWith("custom-")) {
      const mid = id.replace("custom-", "");
      const m = this.customThemes.find((c) => c.id === mid);
      return inferThemeIdIsDark(id, m?.isDark);
    }
    return inferThemeIdIsDark(id);
  }

  async refreshCustomThemes(): Promise<void> {
    try {
      const manifests = await loadManifest();
      const enriched: ThemeManifest[] = [];
      for (const m of manifests) {
        let next = m;
        const needsPreview =
          !m.previewBg || !m.previewAccent || !m.previewText || !m.previewSecondary;
        const needsDark = typeof m.isDark !== "boolean";
        if (needsPreview || needsDark) {
          try {
            const css = await getCustomThemeCss(m.id);
            next = {
              ...m,
              ...(needsPreview ? extractPreviewColors(css) : {}),
              ...(needsDark ? { isDark: inferAppThemeIsDark(parseCssVariables(css)) } : {}),
            };
          } catch {
            if (needsDark) next = { ...m, isDark: false };
          }
        }
        enriched.push(next);
        if (!this.styleElements.has(next.id)) {
          try {
            const css = await getCustomThemeCss(next.id);
            const style = document.createElement("style");
            style.id = `custom-theme-${next.id}`;
            style.textContent = css;
            style.disabled = true;
            document.head.appendChild(style);
            this.styleElements.set(next.id, style);
          } catch {
            /* ignore */
          }
        }
      }
      this.customThemes = enriched;
      const activeIds = new Set(enriched.map((m) => m.id));
      for (const [id, style] of this.styleElements) {
        if (!activeIds.has(id)) {
          style.remove();
          this.styleElements.delete(id);
        }
      }
      this.notify();
    } catch {
      /* ignore */
    }
  }

  async importTheme(filePath: string, name: string): Promise<ThemeManifest> {
    const manifest = await importThemeFs(filePath, name);
    const css = await getCustomThemeCss(manifest.id);
    this.injectOrUpdateStyle(manifest.id, css, false);
    const { themeCss } = getThemeConfig().syncEvents;
    emit(themeCss, { id: manifest.id, css, enable: false }).catch(() => {});
    this.customThemes = [...this.customThemes, manifest];
    this.emitCatalogSync();
    this.notify();
    return manifest;
  }

  async deleteTheme(id: string): Promise<void> {
    await deleteThemeFs(id);
    const style = this.styleElements.get(id);
    if (style) {
      style.remove();
      this.styleElements.delete(id);
    }
    this.customThemes = this.customThemes.filter((m) => m.id !== id);
    this.emitCatalogSync();
    const fullId = `custom-${id}`;
    const next = { ...this.state.preferredAppTheme };
    const fallback = getThemeConfig().defaults.preferredAppTheme ?? DEFAULT_APP_THEME_PAIR;
    if (next.light === fullId) next.light = fallback.light;
    if (next.dark === fullId) next.dark = fallback.dark;
    this.patchState({ preferredAppTheme: next });
  }

  previewThemeVariables(id: string, variables: ThemeVariable[]): void {
    const css = buildThemeCss(id, variables);
    this.injectOrUpdateStyle(id, css, true);
    document.documentElement.dataset.theme = `custom-${id}`;
    const { themeCss } = getThemeConfig().syncEvents;
    emit(themeCss, { id, css, enable: true }).catch(() => {});
    window.dispatchEvent(new CustomEvent("typora-web:appearancechange"));
  }

  async updateThemeVariables(id: string, variables: ThemeVariable[]): Promise<void> {
    const manifest = await persistThemeVariables(id, variables);
    const css = buildThemeCss(id, variables);
    const active = this.getSnapshot().theme === `custom-${id}`;
    this.injectOrUpdateStyle(id, css, active);
    const { themeCss } = getThemeConfig().syncEvents;
    emit(themeCss, { id, css, enable: active }).catch(() => {});
    if (manifest) {
      this.customThemes = this.customThemes.map((m) => (m.id === id ? manifest : m));
      this.notify();
    }
    if (active) {
      window.dispatchEvent(new CustomEvent("typora-web:appearancechange"));
    }
  }

  async createThemeFromBuiltin(builtinId: string, name: string): Promise<ThemeManifest> {
    const vars = getBuiltinThemeVariables(builtinId);
    if (!vars) throw new Error(`Unknown builtin theme: ${builtinId}`);
    const manifest = await createThemeFromVariables(name, vars, inferThemeIdIsDark(builtinId));
    return this.registerNewTheme(manifest);
  }

  async createThemeFromTemplate(kind: "light" | "dark", name: string): Promise<ThemeManifest> {
    const vars = getTemplateVariables(kind);
    const manifest = await createThemeFromVariables(name, vars, kind === "dark");
    return this.registerNewTheme(manifest);
  }

  async renameAppTheme(id: string, name: string): Promise<void> {
    const manifest = await renameThemeFs(id, name);
    if (manifest) {
      this.customThemes = this.customThemes.map((m) => (m.id === id ? manifest : m));
      this.emitCatalogSync();
      this.notify();
    }
  }

  async exportSelectedThemePack(packName: string, appIds: string[]): Promise<string | null> {
    const snap = this.getSnapshot();
    const appEntries = (
      await Promise.all(
        appIds.map(async (id) => {
          const manifest = snap.customThemes.find((m) => m.id === id);
          if (!manifest) return null;
          return exportCustomAppTheme(manifest);
        }),
      )
    ).filter((entry) => entry !== null);

    if (appEntries.length === 0) {
      throw new Error("No themes selected");
    }

    const pack = buildThemePack({ name: packName, app: appEntries, code: [] });
    return exportThemePackToFile(pack);
  }

  async importSelectedThemePack(
    pack: ThemePack,
    selectedAppIndices: number[],
  ): Promise<ThemePackAppImportResult | null> {
    if (selectedAppIndices.length === 0) return null;

    const snap = this.getSnapshot();
    const result = await importSelectedAppThemes(pack, selectedAppIndices, {
      existingAppNames: snap.customThemes.map((theme) => theme.name),
    });

    for (const manifest of result.app) {
      try {
        const css = await getCustomThemeCss(manifest.id);
        this.injectOrUpdateStyle(manifest.id, css, false);
        const { themeCss } = getThemeConfig().syncEvents;
        emit(themeCss, { id: manifest.id, css, enable: false }).catch(() => {});
      } catch {
        /* ignore */
      }
    }

    await this.refreshCustomThemes();
    this.emitCatalogSync();
    this.notify();
    return result;
  }

  resolveAppDisplayName(id: string): string {
    if (id.startsWith("custom-")) {
      const mid = id.replace("custom-", "");
      return this.customThemes.find((m) => m.id === mid)?.name || id;
    }
    return id;
  }

  private async registerNewTheme(manifest: ThemeManifest): Promise<ThemeManifest> {
    const css = await getCustomThemeCss(manifest.id);
    this.injectOrUpdateStyle(manifest.id, css, false);
    const { themeCss } = getThemeConfig().syncEvents;
    emit(themeCss, { id: manifest.id, css, enable: false }).catch(() => {});
    this.customThemes = [...this.customThemes, manifest];
    this.emitCatalogSync();
    this.notify();
    return manifest;
  }

  private async ensureCustomStylesForActive(): Promise<void> {
    const snap = this.getSnapshot();
    if (snap.theme.startsWith("custom-")) {
      const id = snap.theme.replace("custom-", "");
      if (!this.styleElements.has(id)) {
        try {
          const css = await getCustomThemeCss(id);
          this.injectOrUpdateStyle(id, css, true);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private applyThemes(): void {
    const resolvedMode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    const theme = resolveActiveFromPair(this.state.preferredAppTheme, resolvedMode);

    if (isBuiltinTheme(theme)) {
      document.documentElement.dataset.theme = theme;
      this.styleElements.forEach((style) => {
        style.disabled = true;
      });
    } else if (theme.startsWith("custom-")) {
      const id = theme.replace("custom-", "");
      const style = this.styleElements.get(id);
      if (style) {
        this.styleElements.forEach((s) => {
          s.disabled = true;
        });
        style.disabled = false;
      }
      document.documentElement.dataset.theme = theme;
    } else {
      document.documentElement.dataset.theme = "light";
    }

    document.documentElement.dataset.appearance = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    window.dispatchEvent(new CustomEvent("typora-web:appearancechange"));
  }

  private injectOrUpdateStyle(id: string, css: string, enable: boolean): void {
    let style = this.styleElements.get(id);
    if (!style) {
      style = document.createElement("style");
      style.id = `custom-theme-${id}`;
      document.head.appendChild(style);
      this.styleElements.set(id, style);
    }
    style.textContent = css;
    if (enable) {
      this.styleElements.forEach((s, key) => {
        s.disabled = key !== id;
      });
      style.disabled = false;
      document.documentElement.dataset.theme = `custom-${id}`;
    }
  }
}

let instance: AppThemeManager | null = null;

export type { AppThemeManager };

export function getThemeManager(): AppThemeManager {
  if (!instance) instance = new AppThemeManager();
  return instance;
}

export async function initThemeManager(): Promise<AppThemeManager> {
  const mgr = getThemeManager();
  await mgr.init();
  return mgr;
}

/** Reset singleton — for tests only. */
export function resetThemeManagerForTests(): void {
  instance?.destroy();
  instance = null;
}
