import type { AppShortcutId } from "./defaults.ts";
import { TREE_SCOPED_SHORTCUT_IDS } from "./defaults.ts";
import {
  blockNativeShortcut,
  isShortcutRecordingActive,
} from "./guard.ts";
import {
  getShortcutKeys,
  loadShortcuts,
  matchShortcut,
} from "./store.ts";
import { SHORTCUTS_STORAGE_KEY } from "./defaults.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;

export type ShortcutCommandMap = Partial<Record<AppShortcutId, ShortcutCommandHandler>>;

export interface ShortcutHandlerOptions {
  /** Extra gate for explorer shortcuts when DOM focus left the tree after rerender. */
  isTreeShortcutContext?: () => boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** True when focus is inside the files panel tree (not outline/search trees). */
export function isFileTreeFocused(target: EventTarget | null = document.activeElement): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return false;
  return Boolean(
    el.closest('.inimark-sidebar-panel[data-panel="files"] .inimark-tree'),
  );
}

export function mountShortcutHandler(
  commands: ShortcutCommandMap,
  options: ShortcutHandlerOptions = {},
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
    if (
      document.querySelector(
        ".inimark-confirm-dialog, .inimark-quick-open-overlay",
      )
    ) {
      return;
    }
    if (isShortcutRecordingActive()) return;

    const inEditor = isEditableTarget(event.target);
    for (const binding of shortcuts) {
      const keys = getShortcutKeys(shortcuts, binding.id);
      if (!matchShortcut(event, keys)) continue;
      const id = binding.id as AppShortcutId;
      const handler = commands[id];
      if (!handler) continue;

      if (TREE_SCOPED_SHORTCUT_IDS.has(id)) {
        const inTree =
          isFileTreeFocused(event.target) ||
          Boolean(options.isTreeShortcutContext?.());
        if (!inTree) continue;
      }

      // Allow save/close/settings/search even inside editor; block navigation shortcuts in inputs.
      const alwaysAllowed: AppShortcutId[] = [
        "save",
        "save-as",
        "close",
        "open-settings",
        "new",
        "open",
        "open-folder",
        "focus-search",
      ];
      if (inEditor && !alwaysAllowed.includes(id)) {
        continue;
      }

      event.preventDefault();
      event.stopPropagation();
      void handler();
      return;
    }

    blockNativeShortcut(event);
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("storage", onStorage);
  };
}
