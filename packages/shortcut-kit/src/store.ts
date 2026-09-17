export interface ShortcutBinding {
  id: string;
  label: string;
  group: string;
  keys: string[];
}

export function isMacPlatform(): boolean {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("platform-macos")) return true;
    if (
      document.documentElement.classList.contains("platform-windows") ||
      document.documentElement.classList.contains("platform-linux")
    ) {
      return false;
    }
  }
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

export function formatShortcutKey(key: string): string {
  if (!isMacPlatform()) return key;
  switch (key.toLowerCase()) {
    case "ctrl":
    case "meta":
    case "cmd":
      return "⌘";
    case "alt":
      return "⌥";
    case "shift":
      return "⇧";
    default:
      return key;
  }
}

export function formatShortcutDisplay(keys: string[]): string {
  if (keys.length === 0) return "—";
  return keys.map(formatShortcutKey).join("+");
}

export interface ShortcutStoreOptions {
  defaults: ShortcutBinding[];
  storageKey: string;
}

export interface ShortcutStore {
  storageKey: string;
  loadShortcuts: () => ShortcutBinding[];
  saveShortcuts: (shortcuts: ShortcutBinding[]) => void;
  getShortcutKeys: (shortcuts: ShortcutBinding[], id: string) => string[];
}

export function createShortcutStore(options: ShortcutStoreOptions): ShortcutStore {
  const { defaults, storageKey } = options;

  function loadShortcuts(): ShortcutBinding[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults.map((item) => ({ ...item, keys: [...item.keys] }));
      const parsed = JSON.parse(raw) as Array<Pick<ShortcutBinding, "id" | "keys">>;
      return defaults.map((def) => {
        const saved = parsed.find((item) => item.id === def.id);
        return saved
          ? { ...def, keys: [...saved.keys] }
          : { ...def, keys: [...def.keys] };
      });
    } catch {
      return defaults.map((item) => ({ ...item, keys: [...item.keys] }));
    }
  }

  function saveShortcuts(shortcuts: ShortcutBinding[]): void {
    localStorage.setItem(
      storageKey,
      JSON.stringify(shortcuts.map(({ id, keys }) => ({ id, keys }))),
    );
  }

  function getShortcutKeys(shortcuts: ShortcutBinding[], id: string): string[] {
    return shortcuts.find((item) => item.id === id)?.keys ?? [];
  }

  return { storageKey, loadShortcuts, saveShortcuts, getShortcutKeys };
}

export function matchShortcut(event: KeyboardEvent, keys: string[]): boolean {
  if (keys.length === 0) return false;

  const required = keys.map((key) => key.toLowerCase());
  const hasCtrl = required.includes("ctrl");
  const hasShift = required.includes("shift");
  const hasAlt = required.includes("alt");
  const hasMeta = required.includes("meta") || required.includes("cmd");

  const primaryMod = event.ctrlKey || event.metaKey;
  if (hasCtrl !== primaryMod) return false;
  if (hasShift !== event.shiftKey) return false;
  if (hasAlt !== event.altKey) return false;
  if (hasMeta && !hasCtrl && !event.metaKey) return false;

  const mainKey = required.find(
    (key) => !["ctrl", "shift", "alt", "meta", "cmd"].includes(key),
  );
  if (!mainKey) return false;

  const keyLower = event.key.toLowerCase();
  if (keyLower === mainKey) return true;
  if (event.code.toLowerCase() === `key${mainKey}`) return true;
  if (event.code.toLowerCase() === mainKey) return true;

  const codeMap: Record<string, string> = {
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "\\": "Backslash",
    "`": "Backquote",
    "-": "Minus",
    "=": "Equal",
    ";": "Semicolon",
    "'": "Quote",
    "[": "BracketLeft",
    "]": "BracketRight",
  };
  const expectedCode = codeMap[mainKey];
  return expectedCode ? event.code === expectedCode : false;
}

export function keysFromKeyboardEvent(event: KeyboardEvent): string[] | null {
  if (event.key === "Escape") return null;
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return null;

  const keys: string[] = [];
  if (event.ctrlKey || event.metaKey) keys.push("Ctrl");
  if (event.shiftKey) keys.push("Shift");
  if (event.altKey) keys.push("Alt");

  let main = event.key;
  if (main === " ") main = "Space";
  if (main.length === 1) main = main.toUpperCase();
  keys.push(main);
  return keys;
}
