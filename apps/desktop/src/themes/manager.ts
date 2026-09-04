import { emit, listen } from "@tauri-apps/api/event";
import {
  type AppearanceMode,
  type AppearanceState,
  type ResolvedAppearance,
  type ThemePair,
  APPEARANCE_SYNC_EVENT,
  DEFAULT_APP_THEME_PAIR,
  DEFAULT_CODE_THEME_PAIR,
  getSystemIsDark,
  inferCodeThemeIdIsDark,
  inferThemeIdIsDark,
  loadAppearanceState,
  persistAppearanceState,
  resolveActiveFromPair,
  resolveAppearanceMode,
  withPreferredApp,
  withPreferredCode,
} from "./appearance.ts";
import { isBuiltinTheme } from "./builtin.ts";
import { buildCodeThemeStyleContent, expandCodeThemeCss } from "./code-bridge.ts";
import { CODE_THEMES, type CustomCodeTheme } from "./code-themes.ts";
import { getBuiltinCodeThemeIsDark, getBuiltinCodeThemeVariables } from "./code-theme-tokens.ts";
import {
  buildCodeThemeCss,
  buildThemeCss,
  createCodeThemeFromVariables,
  createThemeFromVariables,
  deleteCodeThemeFile,
  deleteTheme as deleteThemeFs,
  extractCodeThemePreviewColors,
  extractPreviewColors,
  getCodeThemeCss,
  getCustomThemeCss,
  importCodeThemeFile,
  importTheme as importThemeFs,
  inferAppThemeIsDark,
  loadCodeThemeManifest,
  loadManifest,
  parseCssVariables,
  persistCodeThemeVariables,
  persistThemeVariables,
  renameCodeTheme as renameCodeThemeFs,
  renameTheme as renameThemeFs,
  type ThemeManifest,
  type ThemeVariable,
} from "./custom-theme-manager.ts";
import {
  buildThemePack,
  exportThemePackToFile,
  importThemePackData,
  pickAndReadThemePackFile,
  type ThemePackImportResult,
} from "./theme-pack.ts";
import { getBuiltinThemeVariables, getTemplateVariables } from "./theme-tokens.ts";
import { getCodeThemeVariables } from "./code-themes.ts";

export type ThemeName = string;

const THEME_CSS_EVENT = "theme-css-updated";
const CODE_THEME_CSS_EVENT = "code-theme-css-updated";

type ThemeCssPayload = { id: string; css: string; enable: boolean };
type CodeThemeCssPayload = { id: string; css: string; enable: boolean };

type Listener = () => void;

export interface ThemeManagerSnapshot {
  appearanceMode: AppearanceMode;
  resolvedMode: ResolvedAppearance;
  theme: ThemeName;
  codeTheme: string;
  preferredAppTheme: ThemePair;
  preferredCodeTheme: ThemePair;
  customThemes: ThemeManifest[];
  customCodeThemes: CustomCodeTheme[];
}

class ThemeManager {
  private state: AppearanceState;
  private systemIsDark = getSystemIsDark();
  private customThemes: ThemeManifest[] = [];
  private customCodeThemes: CustomCodeTheme[] = [];
  private styleElements = new Map<string, HTMLStyleElement>();
  private listeners = new Set<Listener>();
  private mediaQuery: MediaQueryList | null = null;
  private unlistenAppearance: (() => void) | undefined;
  private unlistenCss: (() => void) | undefined;
  private unlistenCodeCss: (() => void) | undefined;
  private initialized = false;

  constructor() {
    this.state = loadAppearanceState();
  }

  getSnapshot(): ThemeManagerSnapshot {
    const resolvedMode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    return {
      appearanceMode: this.state.appearanceMode,
      resolvedMode,
      theme: resolveActiveFromPair(this.state.preferredAppTheme, resolvedMode),
      codeTheme: resolveActiveFromPair(this.state.preferredCodeTheme, resolvedMode),
      preferredAppTheme: { ...this.state.preferredAppTheme },
      preferredCodeTheme: { ...this.state.preferredCodeTheme },
      customThemes: [...this.customThemes],
      customCodeThemes: [...this.customCodeThemes],
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private patchState(patch: Partial<AppearanceState>): void {
    this.state = {
      appearanceMode: patch.appearanceMode ?? this.state.appearanceMode,
      preferredAppTheme: patch.preferredAppTheme ?? this.state.preferredAppTheme,
      preferredCodeTheme: patch.preferredCodeTheme ?? this.state.preferredCodeTheme,
    };
    persistAppearanceState(this.state);
    this.applyThemes();
    emit(APPEARANCE_SYNC_EVENT, this.state).catch(() => {});
    this.notify();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      this.systemIsDark = this.mediaQuery?.matches ?? false;
      this.applyThemes();
      this.notify();
    };
    onSystemChange();
    this.mediaQuery.addEventListener("change", onSystemChange);

    this.unlistenAppearance = await listen<AppearanceState>(APPEARANCE_SYNC_EVENT, async (event) => {
      const next = event.payload;
      if (!next) return;
      this.state = next;
      persistAppearanceState(next);
      await this.ensureCustomStylesForActive();
      this.applyThemes();
      this.notify();
    });

    this.unlistenCss = await listen<ThemeCssPayload>(THEME_CSS_EVENT, (event) => {
      const { id, css, enable } = event.payload;
      this.injectOrUpdateStyle(id, css, enable);
    });

    this.unlistenCodeCss = await listen<CodeThemeCssPayload>(CODE_THEME_CSS_EVENT, (event) => {
      const { id, css, enable } = event.payload;
      // Apply only — do not re-emit or windows echo forever and freeze.
      this.injectOrUpdateCodeThemeStyle(id, css, enable);
    });

    setTimeout(() => {
      void this.refreshCustomThemes();
      void this.refreshCustomCodeThemes();
    }, 300);

    this.applyThemes();
  }

  destroy(): void {
    this.mediaQuery?.removeEventListener("change", () => {});
    this.unlistenAppearance?.();
    this.unlistenCss?.();
    this.unlistenCodeCss?.();
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

  setPreferredCodeTheme(mode: ResolvedAppearance, id: string): void {
    this.patchState({
      preferredCodeTheme: withPreferredCode(this.state.preferredCodeTheme, mode, id),
    });
  }

  setTheme(id: ThemeName): void {
    const mode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    this.patchState({
      preferredAppTheme: withPreferredApp(this.state.preferredAppTheme, mode, id),
    });
  }

  setCodeTheme(id: string): void {
    const mode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    this.patchState({
      preferredCodeTheme: withPreferredCode(this.state.preferredCodeTheme, mode, id),
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

  getCodeThemeIsDark(id: string): boolean {
    if (id.startsWith("custom-")) {
      const m = this.customCodeThemes.find((c) => c.id === id);
      return inferCodeThemeIdIsDark(id, m?.isDark);
    }
    return inferCodeThemeIdIsDark(id);
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
      this.notify();
    } catch {
      /* ignore */
    }
  }

  async refreshCustomCodeThemes(): Promise<void> {
    try {
      const manifests = await loadCodeThemeManifest();
      const enriched: CustomCodeTheme[] = [];
      for (const m of manifests) {
        let next = m;
        if (!m.previewColors || m.previewColors.length === 0) {
          try {
            const css = await getCodeThemeCss(m.id);
            next = {
              ...m,
              previewColors: extractCodeThemePreviewColors(parseCssVariables(css)),
            };
          } catch {
            /* ignore */
          }
        }
        enriched.push(next);
        if (!document.getElementById(`code-theme-${next.id}`)) {
          const css = await getCodeThemeCss(next.id);
          if (css) {
            const style = document.createElement("style");
            style.id = `code-theme-${next.id}`;
            style.textContent = expandCodeThemeCss(css);
            style.disabled = true;
            document.head.appendChild(style);
          }
        }
      }
      this.customCodeThemes = enriched;
      this.notify();
    } catch {
      /* ignore */
    }
  }

  async importTheme(filePath: string, name: string): Promise<ThemeManifest> {
    const manifest = await importThemeFs(filePath, name);
    const css = await getCustomThemeCss(manifest.id);
    this.injectOrUpdateStyle(manifest.id, css, false);
    emit(THEME_CSS_EVENT, { id: manifest.id, css, enable: false }).catch(() => {});
    this.customThemes = [...this.customThemes, manifest];
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
    const fullId = `custom-${id}`;
    const next = { ...this.state.preferredAppTheme };
    if (next.light === fullId) next.light = DEFAULT_APP_THEME_PAIR.light;
    if (next.dark === fullId) next.dark = DEFAULT_APP_THEME_PAIR.dark;
    this.patchState({ preferredAppTheme: next });
  }

  previewThemeVariables(id: string, variables: ThemeVariable[]): void {
    const css = buildThemeCss(id, variables);
    this.injectOrUpdateStyle(id, css, true);
    document.documentElement.dataset.theme = `custom-${id}`;
    emit(THEME_CSS_EVENT, { id, css, enable: true }).catch(() => {});
  }

  async updateThemeVariables(id: string, variables: ThemeVariable[]): Promise<void> {
    const manifest = await persistThemeVariables(id, variables);
    const css = buildThemeCss(id, variables);
    const active = this.getSnapshot().theme === `custom-${id}`;
    this.injectOrUpdateStyle(id, css, active);
    emit(THEME_CSS_EVENT, { id, css, enable: active }).catch(() => {});
    if (manifest) {
      this.customThemes = this.customThemes.map((m) => (m.id === id ? manifest : m));
      this.notify();
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
      this.notify();
    }
  }

  async importCodeTheme(filePath: string, name: string): Promise<CustomCodeTheme> {
    const manifest = await importCodeThemeFile(filePath, name);
    const css = await getCodeThemeCss(manifest.id);
    if (css) {
      const expanded = expandCodeThemeCss(css);
      this.injectOrUpdateCodeThemeStyle(manifest.id, expanded, false);
      emit(CODE_THEME_CSS_EVENT, { id: manifest.id, css: expanded, enable: false }).catch(() => {});
    }
    this.customCodeThemes = [...this.customCodeThemes, manifest];
    this.notify();
    return manifest;
  }

  async deleteCodeTheme(id: string): Promise<void> {
    await deleteCodeThemeFile(id);
    document.getElementById(`code-theme-${id}`)?.remove();
    this.customCodeThemes = this.customCodeThemes.filter((m) => m.id !== id);
    const next = { ...this.state.preferredCodeTheme };
    if (next.light === id) next.light = DEFAULT_CODE_THEME_PAIR.light;
    if (next.dark === id) next.dark = DEFAULT_CODE_THEME_PAIR.dark;
    this.patchState({ preferredCodeTheme: next });
  }

  previewCodeThemeVariables(id: string, variables: ThemeVariable[]): void {
    const css = expandCodeThemeCss(buildCodeThemeCss(variables));
    this.injectOrUpdateCodeThemeStyle(id, css, true);
    emit(CODE_THEME_CSS_EVENT, { id, css, enable: true }).catch(() => {});
  }

  async updateCodeThemeVariables(
    id: string,
    variables: ThemeVariable[],
    isDark?: boolean,
  ): Promise<void> {
    const manifest = await persistCodeThemeVariables(id, variables, isDark);
    const css = expandCodeThemeCss(buildCodeThemeCss(variables));
    const enable = this.getSnapshot().codeTheme === id;
    this.injectOrUpdateCodeThemeStyle(id, css, enable);
    emit(CODE_THEME_CSS_EVENT, { id, css, enable }).catch(() => {});
    if (manifest) {
      this.customCodeThemes = this.customCodeThemes.map((m) => (m.id === id ? manifest : m));
      this.notify();
    }
  }

  async createCodeThemeFromBuiltin(builtinId: string, name: string): Promise<CustomCodeTheme> {
    const vars = getBuiltinCodeThemeVariables(builtinId);
    if (!vars) throw new Error(`Unknown builtin code theme: ${builtinId}`);
    const manifest = await createCodeThemeFromVariables(name, vars, getBuiltinCodeThemeIsDark(builtinId));
    const css = await getCodeThemeCss(manifest.id);
    if (css) {
      const expanded = expandCodeThemeCss(css);
      this.injectOrUpdateCodeThemeStyle(manifest.id, expanded, false);
      emit(CODE_THEME_CSS_EVENT, { id: manifest.id, css: expanded, enable: false }).catch(() => {});
    }
    this.customCodeThemes = [...this.customCodeThemes, manifest];
    this.notify();
    return manifest;
  }

  async renameCodeTheme(id: string, name: string): Promise<void> {
    const manifest = await renameCodeThemeFs(id, name);
    if (manifest) {
      this.customCodeThemes = this.customCodeThemes.map((m) => (m.id === id ? manifest : m));
      this.notify();
    }
  }

  async exportCurrentThemePack(packName: string): Promise<string | null> {
    const snap = this.getSnapshot();
    const pack = await buildThemePack({
      name: packName,
      preferredAppTheme: snap.preferredAppTheme,
      preferredCodeTheme: snap.preferredCodeTheme,
      resolveAppName: (id) => this.resolveAppDisplayName(id),
      resolveCodeName: (id) => this.resolveCodeDisplayName(id),
    });
    return exportThemePackToFile(pack);
  }

  async importThemePack(): Promise<ThemePackImportResult | null> {
    const picked = await pickAndReadThemePackFile();
    if (!picked) return null;
    const result = await importThemePackData(picked.pack);

    for (const fullId of [result.preferredAppTheme.light, result.preferredAppTheme.dark]) {
      const id = fullId.replace("custom-", "");
      try {
        const css = await getCustomThemeCss(id);
        this.injectOrUpdateStyle(id, css, false);
        emit(THEME_CSS_EVENT, { id, css, enable: false }).catch(() => {});
      } catch {
        /* ignore */
      }
    }
    for (const id of [result.preferredCodeTheme.light, result.preferredCodeTheme.dark]) {
      try {
        const css = await getCodeThemeCss(id);
        if (css) {
          const expanded = expandCodeThemeCss(css);
          this.injectOrUpdateCodeThemeStyle(id, expanded, false);
          emit(CODE_THEME_CSS_EVENT, { id, css: expanded, enable: false }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }

    await this.refreshCustomThemes();
    await this.refreshCustomCodeThemes();
    this.patchState({
      preferredAppTheme: result.preferredAppTheme,
      preferredCodeTheme: result.preferredCodeTheme,
    });
    return result;
  }

  resolveAppDisplayName(id: string): string {
    if (id.startsWith("custom-")) {
      const mid = id.replace("custom-", "");
      return this.customThemes.find((m) => m.id === mid)?.name || id;
    }
    return id;
  }

  resolveCodeDisplayName(id: string): string {
    return CODE_THEMES.find((c) => c.id === id)?.name
      ?? this.customCodeThemes.find((m) => m.id === id)?.name
      ?? id;
  }

  private async registerNewTheme(manifest: ThemeManifest): Promise<ThemeManifest> {
    const css = await getCustomThemeCss(manifest.id);
    this.injectOrUpdateStyle(manifest.id, css, false);
    emit(THEME_CSS_EVENT, { id: manifest.id, css, enable: false }).catch(() => {});
    this.customThemes = [...this.customThemes, manifest];
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
    if (snap.codeTheme.startsWith("custom-")) {
      if (!document.getElementById(`code-theme-${snap.codeTheme}`)) {
        try {
          const css = await getCodeThemeCss(snap.codeTheme);
          if (css) this.injectOrUpdateCodeThemeStyle(snap.codeTheme, expandCodeThemeCss(css), true);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private applyThemes(): void {
    const resolvedMode = resolveAppearanceMode(this.state.appearanceMode, this.systemIsDark);
    const theme = resolveActiveFromPair(this.state.preferredAppTheme, resolvedMode);
    const codeTheme = resolveActiveFromPair(this.state.preferredCodeTheme, resolvedMode);

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
      document.documentElement.dataset.theme = "mint";
    }

    document.documentElement.dataset.appearance = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;

    this.applyCodeTheme(codeTheme);
  }

  private applyCodeTheme(codeTheme: string): void {
    this.customCodeThemes.forEach((m) => {
      const style = document.getElementById(`code-theme-${m.id}`) as HTMLStyleElement | null;
      if (style) style.disabled = true;
    });

    document.getElementById("code-theme-vars")?.remove();

    if (codeTheme.startsWith("custom-")) {
      const style = document.getElementById(`code-theme-${codeTheme}`) as HTMLStyleElement | null;
      if (style) style.disabled = false;
    } else {
      const vars = getCodeThemeVariables(codeTheme);
      if (Object.keys(vars).length > 0) {
        const style = document.createElement("style");
        style.id = "code-theme-vars";
        style.textContent = buildCodeThemeStyleContent(vars);
        document.head.appendChild(style);
      }
    }

    window.dispatchEvent(new CustomEvent("code-theme-changed"));
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

  private injectOrUpdateCodeThemeStyle(id: string, css: string, enable: boolean): void {
    let style = document.getElementById(`code-theme-${id}`) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = `code-theme-${id}`;
      document.head.appendChild(style);
    }
    style.textContent = css;
    if (enable) {
      document.querySelectorAll<HTMLStyleElement>("[id^='code-theme-custom-']").forEach((s) => {
        s.disabled = s.id !== `code-theme-${id}`;
      });
      document.getElementById("code-theme-vars")?.remove();
      style.disabled = false;
      window.dispatchEvent(new CustomEvent("code-theme-changed"));
      window.dispatchEvent(new CustomEvent("typora-web:appearancechange"));
    }
  }
}

let instance: ThemeManager | null = null;

export function getThemeManager(): ThemeManager {
  if (!instance) instance = new ThemeManager();
  return instance;
}

export async function initThemeManager(): Promise<ThemeManager> {
  const mgr = getThemeManager();
  await mgr.init();
  return mgr;
}
