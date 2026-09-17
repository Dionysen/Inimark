import {
  createShortcutStore,
  formatShortcutDisplay,
  matchShortcut,
  type ShortcutBinding,
} from "@dionysen/shortcut-kit";

export type AppShortcutId = "open-settings" | "close";

export const SHORTCUTS_STORAGE_KEY = "vellum-shortcuts";

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  {
    id: "open-settings",
    label: "Open Settings",
    group: "App",
    keys: ["Ctrl", ","],
  },
  { id: "close", label: "Close", group: "File", keys: ["Ctrl", "W"] },
];

export const shortcutStore = createShortcutStore({
  defaults: DEFAULT_SHORTCUTS,
  storageKey: SHORTCUTS_STORAGE_KEY,
});

export { formatShortcutDisplay, matchShortcut, type ShortcutBinding };
export const loadShortcuts = shortcutStore.loadShortcuts;
export const getShortcutKeys = shortcutStore.getShortcutKeys;
