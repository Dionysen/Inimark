import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, mkdir, remove, readDir } from "@tauri-apps/plugin-fs";

export interface ThemeManifest {
  id: string;
  name: string;
  fileName: string;
  importedAt: string;
  previewBg?: string;
  previewAccent?: string;
  previewText?: string;
  previewSecondary?: string;
  /** Explicit light/dark; inferred from --bg-primary when missing. */
  isDark?: boolean;
}

export interface ThemeVariable {
  name: string;
  value: string;
  type: "color" | "font" | "size" | "text";
}

const MANIFEST_FILE = "manifest.json";

const COLOR_PATTERNS = [
  /^--bg-/, /^--text-/, /^--accent/, /^--border$/, /^--danger$/,
  /^--scrollbar-/, /^--metadata-/, /^--blockquote-/, /^--table-/, /^--tag-/,
  /^--tree-indent-hint-color$/,
  /^--ring$/, /^--card/, /^--popover/, /^--primary/, /^--secondary/,
  /^--muted/, /^--destructive$/, /^--input$/, /^--sidebar/,
  /^--breathe/, /^--highlight/, /^--hljs-/,
];

const FONT_PATTERNS = [/^--font-/, /^--editor-font$/];

const SIZE_PATTERNS = [
  /^--editor-font-size$/,
  /^--font-mono-size$/,
  /^--sidebar-chrome-opacity$/,
  /^--radius/,
  /^--padding-/,
  /^--margin-/,
  /^--scrollbar-size$/,
  /^--blockquote-border-width$/,
  /^--control-/,
  /^--menu-item-/,
  /^--tree-item-/,
  /^--tree-indent-hint-/,
];

let cachedThemesDir: string | null = null;

async function getThemesDir(): Promise<string> {
  if (cachedThemesDir) return cachedThemesDir;
  const baseDir = await appDataDir();
  const sep = navigator.platform?.toLowerCase().includes("win") ? "\\" : "/";
  const dir = `${baseDir}${sep}themes`;
  cachedThemesDir = dir;
  return dir;
}

async function ensureThemesDir(): Promise<string> {
  const dir = await getThemesDir();
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

export async function loadManifest(): Promise<ThemeManifest[]> {
  try {
    const dir = await ensureThemesDir();
    const content = await readTextFile(joinPath(dir, MANIFEST_FILE));
    return JSON.parse(content) as ThemeManifest[];
  } catch {
    return [];
  }
}

export async function saveManifest(manifests: ThemeManifest[]): Promise<void> {
  const dir = await ensureThemesDir();
  await writeTextFile(joinPath(dir, MANIFEST_FILE), JSON.stringify(manifests, null, 2));
}

function generateThemeId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function parseCssVariables(css: string): ThemeVariable[] {
  const variables: ThemeVariable[] = [];
  const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    const type = detectVariableType(name, value);
    variables.push({ name, value, type });
  }

  return variables;
}

function detectVariableType(name: string, value: string): ThemeVariable["type"] {
  if (SIZE_PATTERNS.some((p) => p.test(name))) return "size";
  if (FONT_PATTERNS.some((p) => p.test(name))) return "font";
  if (COLOR_PATTERNS.some((p) => p.test(name))) return "color";
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return "color";
  if (/^rgba?\(/.test(value)) return "color";
  if (/^oklch\(/.test(value)) return "color";
  if (/^hsla?\(/.test(value)) return "color";
  if (/^color-mix\(/.test(value)) return "text";
  if (/^["']?[A-Z]/.test(value) && /[,\s]/.test(value)) return "font";
  if (/system-ui|sans-serif|serif|monospace/.test(value)) return "font";
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return "size";
  return "text";
}

export function convertSelectorsToDataTheme(css: string, themeId: string): string {
  const dataThemeSelector = `[data-theme="custom-${themeId}"]`;
  let result = css.replace(/:root\s*\{/g, `${dataThemeSelector} {`);
  result = result.replace(/\.dark\s*\{/g, `[data-theme="custom-${themeId}-dark"] {`);
  result = result.replace(/\[data-theme="[^"]*"\]\s*\{/g, `${dataThemeSelector} {`);
  result = result.replace(
    /\.dark\s+\[data-theme="[^"]*"\]\s*\{/g,
    `[data-theme="custom-${themeId}-dark"] {`,
  );
  return result;
}

export function buildThemeCss(id: string, variables: ThemeVariable[]): string {
  const lines = variables.map((v) => `  ${v.name}: ${v.value};`);
  return `[data-theme="custom-${id}"] {\n${lines.join("\n")}\n}`;
}

export async function importTheme(
  filePath: string,
  displayName: string,
): Promise<ThemeManifest> {
  const dir = await ensureThemesDir();
  const css = await readTextFile(filePath);
  const id = generateThemeId();
  const processedCss = convertSelectorsToDataTheme(css, id);

  if (!processedCss.includes("--bg-primary")) {
    throw new Error("主题文件缺少必要的 --bg-primary 变量");
  }

  const fileName = `${id}.css`;
  await writeTextFile(joinPath(dir, fileName), processedCss);

  const preview = extractPreviewColors(processedCss);
  const isDark = inferAppThemeIsDark(parseCssVariables(processedCss));

  const manifests = await loadManifest();
  const manifest: ThemeManifest = {
    id,
    name: displayName,
    fileName,
    importedAt: new Date().toISOString(),
    ...preview,
    isDark,
  };
  manifests.push(manifest);
  await saveManifest(manifests);
  return manifest;
}

export async function deleteTheme(id: string): Promise<void> {
  const dir = await ensureThemesDir();
  const manifests = await loadManifest();
  const manifest = manifests.find((m) => m.id === id);

  if (manifest) {
    try {
      await remove(joinPath(dir, manifest.fileName));
    } catch {
      /* ignore */
    }
  }

  await saveManifest(manifests.filter((m) => m.id !== id));
}

export async function getCustomThemeCss(id: string): Promise<string> {
  const dir = await ensureThemesDir();
  return await readTextFile(joinPath(dir, `${id}.css`));
}

export async function saveThemeCss(id: string, css: string): Promise<void> {
  const dir = await ensureThemesDir();
  await writeTextFile(joinPath(dir, `${id}.css`), css);
}

/** Create a custom theme from a full variable list (fork / template). */
export async function createThemeFromVariables(
  displayName: string,
  variables: ThemeVariable[],
  isDark?: boolean,
): Promise<ThemeManifest> {
  const dir = await ensureThemesDir();
  const id = generateThemeId();
  const css = buildThemeCss(id, variables);
  const fileName = `${id}.css`;
  await writeTextFile(joinPath(dir, fileName), css);

  const preview = extractPreviewColors(css);
  const manifests = await loadManifest();
  const manifest: ThemeManifest = {
    id,
    name: displayName,
    fileName,
    importedAt: new Date().toISOString(),
    ...preview,
    isDark: typeof isDark === "boolean" ? isDark : inferAppThemeIsDark(variables),
  };
  manifests.push(manifest);
  await saveManifest(manifests);
  return manifest;
}

export async function renameTheme(id: string, name: string): Promise<ThemeManifest | null> {
  const manifests = await loadManifest();
  const idx = manifests.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  manifests[idx] = { ...manifests[idx], name: name.trim() || manifests[idx].name };
  await saveManifest(manifests);
  return manifests[idx];
}

/** Persist variables and refresh manifest preview colors. */
export async function persistThemeVariables(
  id: string,
  variables: ThemeVariable[],
): Promise<ThemeManifest | null> {
  const css = buildThemeCss(id, variables);
  await saveThemeCss(id, css);
  const preview = extractPreviewColors(css);
  const manifests = await loadManifest();
  const idx = manifests.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  manifests[idx] = {
    ...manifests[idx],
    ...preview,
    isDark: inferAppThemeIsDark(variables),
  };
  await saveManifest(manifests);
  return manifests[idx];
}

export interface ThemePreviewColors {
  previewBg: string;
  previewAccent: string;
  previewText: string;
  previewSecondary: string;
}

export function extractPreviewColors(css: string): ThemePreviewColors {
  const vars = parseCssVariables(css);
  const get = (name: string, fallback: string) =>
    vars.find((v) => v.name === name)?.value || fallback;
  return {
    previewBg: get("--bg-primary", "#ffffff"),
    previewAccent: get("--accent", "#4eb289"),
    previewText: get("--text-primary", "#1e293b"),
    previewSecondary: get("--bg-secondary", get("--border", "#e2e8f0")),
  };
}

/** Resolve preview palette for a manifest (fills gaps for older manifests). */
export function resolveThemePreviewColors(m: ThemeManifest): [string, string, string, string] {
  return [
    m.previewBg || "#ffffff",
    m.previewAccent || "#4eb289",
    m.previewText || "#1e293b",
    m.previewSecondary || m.previewBg || "#e2e8f0",
  ];
}

/** Infer dark UI theme from --bg-primary luminance. */
export function inferAppThemeIsDark(variables: ThemeVariable[]): boolean {
  const bg = variables.find((v) => v.name === "--bg-primary")?.value?.trim();
  if (!bg || !/^#[0-9a-fA-F]{3,8}$/.test(bg)) {
    return /oklch\(\s*0\.[0-4]|rgba?\(\s*\d{1,2}\s*,|#[0-2]/.test(bg || "");
  }
  let h = bg.slice(1);
  if (h.length === 3 || h.length === 4) {
    h = h.split("").map((c) => c + c).join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.45;
}
