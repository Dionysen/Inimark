import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS_STORAGE_KEY,
  type ShortcutBinding,
} from "./defaults.ts";

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

export function loadShortcuts(): ShortcutBinding[] {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS.map((item) => ({ ...item, keys: [...item.keys] }));
    const parsed = JSON.parse(raw) as Array<Pick<ShortcutBinding, "id" | "keys">>;
    return DEFAULT_SHORTCUTS.map((def) => {
      const saved = parsed.find((item) => item.id === def.id);
      return saved ? { ...def, keys: [...saved.keys] } : { ...def, keys: [...def.keys] };
    });
  } catch {
    return DEFAULT_SHORTCUTS.map((item) => ({ ...item, keys: [...item.keys] }));
  }
}

export function saveShortcuts(shortcuts: ShortcutBinding[]): void {
  localStorage.setItem(
    SHORTCUTS_STORAGE_KEY,
    JSON.stringify(shortcuts.map(({ id, keys }) => ({ id, keys }))),
  );
}

export function getShortcutKeys(shortcuts: ShortcutBinding[], id: string): string[] {
  return shortcuts.find((item) => item.id === id)?.keys ?? [];
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
