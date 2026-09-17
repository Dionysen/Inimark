import {
  createShortcutStore,
  formatShortcutDisplay,
  formatShortcutKey,
  isMacPlatform,
  keysFromKeyboardEvent,
  matchShortcut,
  type ShortcutBinding,
} from "@dionysen/shortcut-kit";
import { DEFAULT_SHORTCUTS, SHORTCUTS_STORAGE_KEY } from "./defaults.ts";

export {
  formatShortcutDisplay,
  formatShortcutKey,
  isMacPlatform,
  keysFromKeyboardEvent,
  matchShortcut,
  type ShortcutBinding,
};

export const shortcutStore = createShortcutStore({
  defaults: DEFAULT_SHORTCUTS,
  storageKey: SHORTCUTS_STORAGE_KEY,
});

export const loadShortcuts = shortcutStore.loadShortcuts;
export const saveShortcuts = shortcutStore.saveShortcuts;
export const getShortcutKeys = shortcutStore.getShortcutKeys;
