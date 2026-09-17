import {
  createFontPicker as createFontPickerBase,
  type FontPickerController,
  type FontPickerMode,
  type FontPickerOptions,
} from "@dionysen/ui";
import { listSystemFonts } from "../../settings/system-fonts.ts";

export type { FontPickerController, FontPickerMode, FontPickerOptions };

/** Inimark font picker — injects Tauri-backed system font listing. */
export function createFontPicker(options: FontPickerOptions): FontPickerController {
  return createFontPickerBase({
    ...options,
    listSystemFonts: options.listSystemFonts ?? listSystemFonts,
  });
}
