import {
  createFontPicker,
  type FontPickerController,
  type FontPickerMode,
  type FontPickerOptions,
} from "@dionysen/shell";

export type { FontPickerController, FontPickerMode, FontPickerOptions };

/** Inimark font picker — uses shared Tauri-backed system font listing. */
export { createFontPicker };
