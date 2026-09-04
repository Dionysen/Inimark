import type { AppShortcutId } from "./defaults.ts";
import {
  getShortcutKeys,
  loadShortcuts,
  matchShortcut,
} from "./store.ts";
import { SHORTCUTS_STORAGE_KEY } from "./defaults.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;

export type ShortcutCommandMap = Partial<Record<AppShortcutId, ShortcutCommandHandler>>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function mountShortcutHandler(
  commands: ShortcutCommandMap,
): () => void {
  let shortcuts = loadShortcuts();

  const onStorage = (event: StorageEvent) => {
    if (event.key === SHORTCUTS_STORAGE_KEY) {
      shortcuts = loadShortcuts();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.repeat) return;
    if (document.querySelector(".inimark-confirm-dialog")) return;

    const inEditor = isEditableTarget(event.target);
    for (const binding of shortcuts) {
      const keys = getShortcutKeys(shortcuts, binding.id);
      if (!matchShortcut(event, keys)) continue;
      const handler = commands[binding.id as AppShortcutId];
      if (!handler) continue;

      // Allow save/close/settings even inside editor; block navigation shortcuts in inputs.
      const alwaysAllowed: AppShortcutId[] = [
        "save",
        "save-as",
        "close",
        "open-settings",
        "new",
        "open",
        "open-folder",
      ];
      if (inEditor && !alwaysAllowed.includes(binding.id as AppShortcutId)) {
        continue;
      }

      event.preventDefault();
      void handler();
      return;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("storage", onStorage);
  };
}
