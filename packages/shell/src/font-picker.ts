import {
  createFontPicker as createFontPickerBase,
  type FontPickerController,
  type FontPickerMode,
  type FontPickerOptions,
} from "@dionysen/ui";
import { listSystemFonts } from "./system-fonts.ts";

export type { FontPickerController, FontPickerMode, FontPickerOptions };

/**
 * Font picker with Tauri-backed system font listing injected by default.
 * Hosts may still override `listSystemFonts` for tests.
 */
export function createFontPicker(
  options: FontPickerOptions,
): FontPickerController {
  return createFontPickerBase({
    ...options,
    listSystemFonts: options.listSystemFonts ?? listSystemFonts,
  });
}
