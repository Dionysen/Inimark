import { invoke } from "@tauri-apps/api/core";
import type { SystemFontInfo } from "@dionysen/ui";

export {
  FONT_PRESETS,
  SYSTEM_FONT_SENTINEL,
  quoteFontFamily,
  isFontStack,
  resolveFontValue,
  normalizeFontValue,
  isValidFontSetting,
  type FontPresetId,
  type SystemFontInfo,
} from "@dionysen/ui";

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
