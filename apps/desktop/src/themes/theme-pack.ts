import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  buildThemeCss,
  createCodeThemeFromVariables,
  createThemeFromVariables,
  getCodeThemeCss,
  getCustomThemeCss,
  inferAppThemeIsDark,
  inferCodeThemeIsDark,
  parseCssVariables,
  type ThemeManifest,
  type ThemeVariable,
} from "./custom-theme-manager.ts";
import type { CustomCodeTheme } from "./code-themes.ts";

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

export interface ThemePackSelectionImportResult {
  app: ThemeManifest[];
  code: CustomCodeTheme[];
  packName: string;
}

function variablesToRecord(vars: ThemeVariable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of vars) out[v.name] = v.value;
  return out;
}

function recordToVariables(record: Record<string, string>): ThemeVariable[] {
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

export async function exportCustomCodeTheme(
  manifest: CustomCodeTheme,
): Promise<ThemePackThemeEntry> {
  const css = await getCodeThemeCss(manifest.id);
  const vars = parseCssVariables(css).filter((v) => v.name.startsWith("--hljs-"));
  return {
    name: manifest.name,
    variables: variablesToRecord(vars),
  };
}

export function buildThemePack(options: {
  name: string;
  app: ThemePackThemeEntry[];
  code: ThemePackThemeEntry[];
}): ThemePack {
  return {
    format: THEME_PACK_FORMAT,
    version: THEME_PACK_VERSION,
    name: options.name.trim() || "Inimark Theme",
    exportedAt: new Date().toISOString(),
    themes: {
      app: options.app,
      code: options.code,
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
  if (pack.format !== THEME_PACK_FORMAT) {
    throw new Error("Not a Inimark theme pack");
  }
  if (pack.version !== THEME_PACK_VERSION) {
    throw new Error(`Unsupported theme pack version: ${String(pack.version)}`);
  }
  if (!pack.name || !Array.isArray(pack.themes?.app) || !Array.isArray(pack.themes?.code)) {
    throw new Error("Theme pack missing themes");
  }
  return pack as ThemePack;
}

export async function importSelectedThemes(
  pack: ThemePack,
  selectedAppIndices: number[],
  selectedCodeIndices: number[],
  options: {
    existingAppNames: string[];
    existingCodeNames: string[];
  },
): Promise<ThemePackSelectionImportResult> {
  const usedAppNames = new Set(options.existingAppNames);
  const usedCodeNames = new Set(options.existingCodeNames);

  // Import sequentially: manifest read-modify-write is not safe in parallel.
  const app: ThemeManifest[] = [];
  for (const index of selectedAppIndices) {
    const entry = pack.themes.app[index];
    if (!entry) throw new Error("Invalid app theme selection");
    const vars = recordToVariables(entry.variables);
    const name = allocateUniqueThemeName(entry.name, usedAppNames);
    app.push(await createThemeFromVariables(name, vars, inferAppThemeIsDark(vars)));
  }

  const code: CustomCodeTheme[] = [];
  for (const index of selectedCodeIndices) {
    const entry = pack.themes.code[index];
    if (!entry) throw new Error("Invalid code theme selection");
    const vars = recordToVariables(entry.variables).filter((v) =>
      v.name.startsWith("--hljs-"),
    );
    const name = allocateUniqueThemeName(entry.name, usedCodeNames);
    code.push(await createCodeThemeFromVariables(name, vars, inferCodeThemeIsDark(vars)));
  }

  return {
    packName: pack.name,
    app,
    code,
  };
}

export async function exportThemePackToFile(pack: ThemePack): Promise<string | null> {
  const safeName = pack.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "inimark-theme";
  const filePath = await save({
    defaultPath: `${safeName}.inimark-theme.json`,
    filters: [{ name: "Inimark Theme Pack", extensions: ["json", "inimark-theme.json"] }],
  });
  if (!filePath) return null;
  await writeTextFile(filePath, JSON.stringify(pack, null, 2));
  return filePath;
}

export async function pickAndReadThemePackFile(): Promise<{
  filePath: string;
  pack: ThemePack;
} | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Inimark Theme Pack", extensions: ["json"] }],
    title: "Import Theme Pack",
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
