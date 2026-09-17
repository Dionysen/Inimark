import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  buildThemeCss,
  createThemeFromVariables,
  getCustomThemeCss,
  inferAppThemeIsDark,
  parseCssVariables,
  type ThemeManifest,
  type ThemeVariable,
} from "./theme-store.ts";
import { getThemeConfig, tryGetThemeConfig } from "./config.ts";

export const THEME_PACK_FORMAT = "inimark-theme-pack" as const;
export const THEME_PACK_VERSION = 2 as const;

export interface ThemePackThemeEntry {
  name: string;
  variables: Record<string, string>;
}

export interface ThemePack {
  format: typeof THEME_PACK_FORMAT;
  version: typeof THEME_PACK_VERSION;
  name: string;
  exportedAt: string;
  themes: {
    app: ThemePackThemeEntry[];
    code: ThemePackThemeEntry[];
  };
}

export interface ThemePackAppImportResult {
  app: ThemeManifest[];
  packName: string;
}

function variablesToRecord(vars: ThemeVariable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of vars) out[v.name] = v.value;
  return out;
}

export function recordToVariables(record: Record<string, string>): ThemeVariable[] {
  return Object.entries(record).map(([name, value]) => ({
    name,
    value,
    type:
      name.startsWith("--hljs-") ||
      name.startsWith("--bg-") ||
      name.startsWith("--text-") ||
      name.startsWith("--accent") ||
      name === "--border" ||
      name === "--danger"
        ? ("color" as const)
        : /^\d+(\.\d+)?(px|rem|em|%)$/.test(value)
          ? ("size" as const)
          : ("text" as const),
  }));
}

export function allocateUniqueThemeName(baseName: string, used: Set<string>): string {
  const base = baseName.trim() || "Theme";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base} ${suffix}`)) suffix += 1;
  const unique = `${base} ${suffix}`;
  used.add(unique);
  return unique;
}

export async function exportCustomAppTheme(manifest: ThemeManifest): Promise<ThemePackThemeEntry> {
  const css = await getCustomThemeCss(manifest.id);
  const vars = parseCssVariables(css);
  return {
    name: manifest.name,
    variables: variablesToRecord(vars),
  };
}

export function buildThemePack(options: {
  name: string;
  app: ThemePackThemeEntry[];
  code?: ThemePackThemeEntry[];
}): ThemePack {
  return {
    format: THEME_PACK_FORMAT,
    version: THEME_PACK_VERSION,
    name: options.name.trim() || "Theme Pack",
    exportedAt: new Date().toISOString(),
    themes: {
      app: options.app,
      code: options.code ?? [],
    },
  };
}

export function parseThemePack(raw: string): ThemePack {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid theme pack JSON");
  }
  if (!data || typeof data !== "object") throw new Error("Invalid theme pack");
  const pack = data as Partial<ThemePack>;
  const expectedFormat = tryGetThemeConfig()?.pack.format ?? THEME_PACK_FORMAT;
  if (pack.format !== expectedFormat && pack.format !== THEME_PACK_FORMAT) {
    throw new Error("Not a theme pack");
  }
  if (pack.version !== THEME_PACK_VERSION) {
    throw new Error(`Unsupported theme pack version: ${String(pack.version)}`);
  }
  if (!pack.name || !Array.isArray(pack.themes?.app) || !Array.isArray(pack.themes?.code)) {
    throw new Error("Theme pack missing themes");
  }
  return pack as ThemePack;
}

/** Import selected app themes from a pack (code entries ignored). */
export async function importSelectedAppThemes(
  pack: ThemePack,
  selectedAppIndices: number[],
  options: { existingAppNames: string[] },
): Promise<ThemePackAppImportResult> {
  const usedAppNames = new Set(options.existingAppNames);
  const app: ThemeManifest[] = [];
  for (const index of selectedAppIndices) {
    const entry = pack.themes.app[index];
    if (!entry) throw new Error("Invalid app theme selection");
    const vars = recordToVariables(entry.variables);
    const name = allocateUniqueThemeName(entry.name, usedAppNames);
    app.push(await createThemeFromVariables(name, vars, inferAppThemeIsDark(vars)));
  }
  return { packName: pack.name, app };
}

export async function exportThemePackToFile(pack: ThemePack): Promise<string | null> {
  const cfg = tryGetThemeConfig();
  const ext = cfg?.pack.fileExtension ?? "inimark-theme.json";
  const title = cfg?.pack.dialogTitle ?? "Theme Pack";
  const safeName = pack.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "theme";
  const filePath = await save({
    defaultPath: `${safeName}.${ext}`,
    filters: [{ name: title, extensions: ["json", ext] }],
  });
  if (!filePath) return null;
  await writeTextFile(filePath, JSON.stringify(pack, null, 2));
  return filePath;
}

export async function pickAndReadThemePackFile(): Promise<{
  filePath: string;
  pack: ThemePack;
} | null> {
  const cfg = tryGetThemeConfig();
  const title = cfg?.pack.dialogTitle ?? "Import Theme Pack";
  const selected = await open({
    multiple: false,
    filters: [{ name: title, extensions: ["json"] }],
    title,
  });
  if (!selected || typeof selected !== "string") return null;
  const raw = await readTextFile(selected);
  const pack = parseThemePack(raw);
  return { filePath: selected, pack };
}

/** Build :root CSS string for preview/debug from a theme entry. */
export function slotToRootCss(slot: ThemePackThemeEntry): string {
  const vars = recordToVariables(slot.variables);
  return buildThemeCss("preview", vars).replace(/\[data-theme="custom-preview"\]/, ":root");
}

export function getPackFormat(): string {
  return getThemeConfig().pack.format;
}
