import { invoke } from "@tauri-apps/api/core";

export interface SystemFontInfo {
  family: string;
  monospaced: boolean;
}

export const SYSTEM_FONT_SENTINEL = "system";

export const FONT_PRESETS = {
  system: {
    label: "System UI",
    css: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  serif: {
    label: "Serif",
    css: 'Georgia, "Times New Roman", "Songti SC", serif',
  },
  rounded: {
    label: "Rounded Sans",
    css: '"Avenir Next", "Segoe UI", "PingFang SC", sans-serif',
  },
  mono: {
    label: "Monospace",
    css: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  code: {
    label: "Code",
    css: '"Cascadia Code", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
  },
} as const;

export type FontPresetId = keyof typeof FONT_PRESETS;

let cachedFonts: SystemFontInfo[] | null = null;
let loadingPromise: Promise<SystemFontInfo[]> | null = null;

/** Fetch and cache installed system fonts (empty array on failure). */
export async function listSystemFonts(force = false): Promise<SystemFontInfo[]> {
  if (!force && cachedFonts) return cachedFonts;
  if (!force && loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const fonts = await invoke<SystemFontInfo[]>("list_system_fonts");
      cachedFonts = Array.isArray(fonts) ? fonts : [];
      return cachedFonts;
    } catch {
      cachedFonts = [];
      return cachedFonts;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export function quoteFontFamily(family: string): string {
  const trimmed = family.trim();
  if (!trimmed) return trimmed;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }
  if (/[\s,]/.test(trimmed)) return `"${trimmed.replace(/"/g, '\\"')}"`;
  return trimmed;
}

export function isFontStack(value: string): boolean {
  return value.includes(",") || /system-ui|-apple-system|sans-serif|monospace|serif/i.test(value);
}

export function resolveFontValue(
  value: string | undefined | null,
  fallback: FontPresetId,
): string {
  if (!value || value === SYSTEM_FONT_SENTINEL) {
    return FONT_PRESETS[fallback].css;
  }
  if (value in FONT_PRESETS) {
    return FONT_PRESETS[value as FontPresetId].css;
  }
  if (isFontStack(value)) return value;
  return `${quoteFontFamily(value)}, ${FONT_PRESETS[fallback].css}`;
}

/** Normalize a stored setting into a picker value (preset id or family name). */
export function normalizeFontValue(
  value: string | undefined | null,
  fallback: FontPresetId,
): string {
  if (!value) return fallback;
  if (value in FONT_PRESETS) return value;
  if (value === FONT_PRESETS[fallback].css) return fallback;
  if (isFontStack(value)) {
    const first = value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    if (
      !first ||
      /^(system-ui|-apple-system|sans-serif|serif|monospace|ui-sans-serif|ui-monospace)$/i.test(
        first,
      )
    ) {
      return fallback;
    }
    return first;
  }
  return value.trim() || fallback;
}

export function isValidFontSetting(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
