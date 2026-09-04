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
  { id: "open-settings", label: "Open Settings", group: "App", keys: ["Ctrl", ","] },
];

export type AppShortcutId = (typeof DEFAULT_SHORTCUTS)[number]["id"];
