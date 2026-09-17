import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, mkdir, remove, readDir } from "@tauri-apps/plugin-fs";
import type { CustomCodeTheme } from "./code-themes.ts";
import {
  parseCssVariables,
  type ThemeVariable,
} from "@dionysen/theme";

export {
  type ThemeManifest,
  type ThemeVariable,
  type ThemePreviewColors,
  loadManifest,
  saveManifest,
  parseCssVariables,
  convertSelectorsToDataTheme,
  buildThemeCss,
  importTheme,
  deleteTheme,
  getCustomThemeCss,
  saveThemeCss,
  createThemeFromVariables,
  renameTheme,
  persistThemeVariables,
  extractPreviewColors,
  resolveThemePreviewColors,
  inferAppThemeIsDark,
} from "@dionysen/theme";

const CODE_THEMES_DIR = "code-themes";

async function getCodeThemesDir(): Promise<string> {
  const baseDir = await appDataDir();
  const sep = navigator.platform?.toLowerCase().includes("win") ? "\\" : "/";
  return `${baseDir}${sep}${CODE_THEMES_DIR}`;
}

async function ensureCodeThemesDir(): Promise<string> {
  const dir = await getCodeThemesDir();
  try {
    await readDir(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

function joinPath(parent: string, child: string): string {
  const sep = navigator.platform?.toLowerCase().includes("win") ? "\\" : "/";
  const clean = parent.endsWith("/") || parent.endsWith("\\") ? parent.slice(0, -1) : parent;
  return `${clean}${sep}${child}`;
}

function generateThemeId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function loadCodeThemeManifest(): Promise<CustomCodeTheme[]> {
  try {
    const dir = await ensureCodeThemesDir();
    const content = await readTextFile(joinPath(dir, "manifest.json"));
    return JSON.parse(content) as CustomCodeTheme[];
  } catch {
    return [];
  }
}

export async function saveCodeThemeManifest(manifests: CustomCodeTheme[]): Promise<void> {
  const dir = await ensureCodeThemesDir();
  await writeTextFile(joinPath(dir, "manifest.json"), JSON.stringify(manifests, null, 2));
}

export function buildCodeThemeCss(variables: ThemeVariable[]): string {
  const hljsVars = variables.filter((v) => v.name.startsWith("--hljs-"));
  const lines = hljsVars.map((v) => `  ${v.name}: ${v.value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

export function extractCodeThemePreviewColors(variables: ThemeVariable[]): string[] {
  const get = (name: string, fallback: string) =>
    variables.find((v) => v.name === name)?.value.trim() || fallback;
  return [
    get("--hljs-keyword", "#d73a49"),
    get("--hljs-string", "#032f62"),
    get("--hljs-comment", "#6a737d"),
    get("--hljs-number", "#005cc5"),
    get("--hljs-built_in", "#e36209"),
  ];
}

/** Infer dark/light from average luminance of highlight colors. */
export function inferCodeThemeIsDark(variables: ThemeVariable[]): boolean {
  const colors = variables
    .filter((v) => v.name.startsWith("--hljs-"))
    .map((v) => v.value.trim())
    .filter((v) => /^#[0-9a-fA-F]{3,8}$/.test(v));
  if (colors.length === 0) return false;

  let sum = 0;
  for (const hex of colors) {
    let h = hex.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h.split("").map((c) => c + c).join("");
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return sum / colors.length > 0.45;
}

export async function createCodeThemeFromVariables(
  displayName: string,
  variables: ThemeVariable[],
  isDark: boolean,
): Promise<CustomCodeTheme> {
  const dir = await ensureCodeThemesDir();
  const id = generateThemeId();
  const css = buildCodeThemeCss(variables);
  const fileName = `${id}.css`;
  await writeTextFile(joinPath(dir, fileName), css);

  const manifests = await loadCodeThemeManifest();
  const manifest: CustomCodeTheme = {
    id: `custom-${id}`,
    name: displayName,
    fileName,
    importedAt: new Date().toISOString(),
    isDark,
    previewColors: extractCodeThemePreviewColors(variables),
  };
  manifests.push(manifest);
  await saveCodeThemeManifest(manifests);
  return manifest;
}

export async function persistCodeThemeVariables(
  id: string,
  variables: ThemeVariable[],
  isDark?: boolean,
): Promise<CustomCodeTheme | null> {
  const dir = await ensureCodeThemesDir();
  const manifests = await loadCodeThemeManifest();
  const idx = manifests.findIndex((m) => m.id === id);
  if (idx < 0) return null;

  const css = buildCodeThemeCss(variables);
  await writeTextFile(joinPath(dir, manifests[idx].fileName), css);

  manifests[idx] = {
    ...manifests[idx],
    previewColors: extractCodeThemePreviewColors(variables),
    isDark: typeof isDark === "boolean" ? isDark : inferCodeThemeIsDark(variables),
  };
  await saveCodeThemeManifest(manifests);
  return manifests[idx];
}

export async function renameCodeTheme(id: string, name: string): Promise<CustomCodeTheme | null> {
  const manifests = await loadCodeThemeManifest();
  const idx = manifests.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  manifests[idx] = { ...manifests[idx], name: name.trim() || manifests[idx].name };
  await saveCodeThemeManifest(manifests);
  return manifests[idx];
}

export async function importCodeThemeFile(
  filePath: string,
  displayName: string,
): Promise<CustomCodeTheme> {
  const css = await readTextFile(filePath);
  const variables = parseCssVariables(css).filter((v) => v.name.startsWith("--hljs-"));
  if (variables.length === 0) {
    throw new Error("代码主题文件缺少 --hljs-* 变量");
  }
  const isDark = inferCodeThemeIsDark(variables);
  return createCodeThemeFromVariables(displayName, variables, isDark);
}

export async function deleteCodeThemeFile(id: string): Promise<void> {
  const dir = await ensureCodeThemesDir();
  const manifests = await loadCodeThemeManifest();
  const manifest = manifests.find((m) => m.id === id);

  if (manifest) {
    try {
      await remove(joinPath(dir, manifest.fileName));
    } catch {
      /* ignore */
    }
  }

  await saveCodeThemeManifest(manifests.filter((m) => m.id !== id));
}

export async function getCodeThemeCss(id: string): Promise<string> {
  const dir = await ensureCodeThemesDir();
  const manifests = await loadCodeThemeManifest();
  const manifest = manifests.find((m) => m.id === id);
  if (!manifest) return "";
  return await readTextFile(joinPath(dir, manifest.fileName));
}
