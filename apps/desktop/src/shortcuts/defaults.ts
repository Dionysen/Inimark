export interface ShortcutBinding {
  id: string;
  label: string;
  group: string;
  keys: string[];
}

export const SHORTCUTS_STORAGE_KEY = "inimark-shortcuts";

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: "save", label: "Save", group: "File", keys: ["Ctrl", "S"] },
  { id: "save-as", label: "Save As", group: "File", keys: ["Ctrl", "Shift", "S"] },
  { id: "new", label: "New File", group: "File", keys: ["Ctrl", "N"] },
  { id: "open", label: "Open File", group: "File", keys: ["Ctrl", "O"] },
  { id: "open-folder", label: "Open Folder", group: "File", keys: ["Ctrl", "Shift", "O"] },
  { id: "close", label: "Close", group: "File", keys: ["Ctrl", "W"] },
  { id: "toggle-sidebar", label: "Toggle Sidebar", group: "View", keys: ["Ctrl", "B"] },
  { id: "focus-search", label: "Search in Files", group: "View", keys: ["Ctrl", "Shift", "F"] },
  { id: "tree-cut", label: "Cut", group: "Explorer", keys: ["Ctrl", "X"] },
  { id: "tree-copy", label: "Copy", group: "Explorer", keys: ["Ctrl", "C"] },
  { id: "tree-paste", label: "Paste", group: "Explorer", keys: ["Ctrl", "V"] },
  { id: "tree-rename", label: "Rename", group: "Explorer", keys: ["F2"] },
  { id: "tree-delete", label: "Delete", group: "Explorer", keys: ["Delete"] },
  { id: "open-settings", label: "Open Settings", group: "App", keys: ["Ctrl", ","] },
];

export type AppShortcutId = (typeof DEFAULT_SHORTCUTS)[number]["id"];

/** Shortcuts that only apply when the file tree has focus. */
export const TREE_SCOPED_SHORTCUT_IDS: ReadonlySet<AppShortcutId> = new Set([
  "tree-cut",
  "tree-copy",
  "tree-paste",
  "tree-rename",
  "tree-delete",
]);
