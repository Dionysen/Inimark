import {
  createShortcutStore,
  formatShortcutDisplay,
  matchShortcut,
  type ShortcutBinding,
} from "@dionysen/shortcut-kit";

export const SHORTCUTS_STORAGE_KEY = "vellum-shortcuts";

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: "save", label: "Save", group: "File", keys: ["Ctrl", "S"] },
  { id: "new-chapter", label: "New Chapter", group: "File", keys: ["Ctrl", "N"] },
  { id: "close", label: "Close", group: "File", keys: ["Ctrl", "W"] },
  { id: "toggle-sidebar", label: "Toggle Sidebar", group: "View", keys: ["Ctrl", "B"] },
  { id: "tree-rename", label: "Rename", group: "Library", keys: ["F2"] },
  { id: "tree-delete", label: "Delete", group: "Library", keys: ["Delete"] },
  { id: "tree-copy", label: "Copy Chapter", group: "Library", keys: ["Ctrl", "C"] },
  { id: "tree-paste", label: "Paste Chapter", group: "Library", keys: ["Ctrl", "V"] },
  { id: "open-settings", label: "Open Settings", group: "App", keys: ["Ctrl", ","] },
];

export type AppShortcutId = (typeof DEFAULT_SHORTCUTS)[number]["id"];

/** Copy, paste, and delete apply only while the library tree has focus. */
export const TREE_SCOPED_SHORTCUT_IDS: ReadonlySet<AppShortcutId> = new Set([
  "tree-copy",
  "tree-paste",
  "tree-delete",
]);

export const shortcutStore = createShortcutStore({
  defaults: DEFAULT_SHORTCUTS,
  storageKey: SHORTCUTS_STORAGE_KEY,
});

export { formatShortcutDisplay, matchShortcut, type ShortcutBinding };
export const loadShortcuts = shortcutStore.loadShortcuts;
export const saveShortcuts = shortcutStore.saveShortcuts;
export const getShortcutKeys = shortcutStore.getShortcutKeys;
