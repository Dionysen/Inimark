import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  THEME_PACK_FORMAT,
  THEME_PACK_VERSION,
  type ThemePackThemeEntry,
  type ThemePack,
  allocateUniqueThemeName,
  exportCustomAppTheme,
  buildThemePack,
  parseThemePack,
  recordToVariables,
  slotToRootCss,
} from "@dionysen/theme";
import type { ThemeManifest } from "@dionysen/theme";
import type { CustomCodeTheme } from "./code-themes.ts";
import {
  createCodeThemeFromVariables,
  getCodeThemeCss,
  inferCodeThemeIsDark,
  parseCssVariables,
  createThemeFromVariables,
  inferAppThemeIsDark,
} from "./custom-theme-manager.ts";

export {
  THEME_PACK_FORMAT,
  THEME_PACK_VERSION,
  type ThemePackThemeEntry,
  type ThemePack,
  allocateUniqueThemeName,
  exportCustomAppTheme,
  buildThemePack,
  parseThemePack,
  slotToRootCss,
};

export interface ThemePackSelectionImportResult {
  app: ThemeManifest[];
  code: CustomCodeTheme[];
  packName: string;
}

export async function exportCustomCodeTheme(
  manifest: CustomCodeTheme,
): Promise<ThemePackThemeEntry> {
  const css = await getCodeThemeCss(manifest.id);
  const vars = parseCssVariables(css).filter((v) => v.name.startsWith("--hljs-"));
  const variables: Record<string, string> = {};
  for (const v of vars) variables[v.name] = v.value;
  return { name: manifest.name, variables };
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

  return { packName: pack.name, app, code };
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
