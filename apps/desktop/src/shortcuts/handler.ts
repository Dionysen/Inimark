import { mountShortcutHandler as mountKitHandler } from "@dionysen/shortcut-kit";
import type { AppShortcutId } from "./defaults.ts";
import { TREE_SCOPED_SHORTCUT_IDS } from "./defaults.ts";
import { inimarkShortcutGuard } from "./guard.ts";
import { shortcutStore } from "./store.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;

export type ShortcutCommandMap = Partial<Record<AppShortcutId, ShortcutCommandHandler>>;

export interface ShortcutHandlerOptions {
  /** Extra gate for explorer shortcuts when DOM focus left the tree after rerender. */
  isTreeShortcutContext?: () => boolean;
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

const ALWAYS_ALLOWED: readonly AppShortcutId[] = [
  "save",
  "save-as",
  "close",
  "open-settings",
  "new",
  "open",
  "open-folder",
  "focus-search",
  "focus-ai",
];

export function mountShortcutHandler(
  commands: ShortcutCommandMap,
  options: ShortcutHandlerOptions = {},
): () => void {
  return mountKitHandler<AppShortcutId>({
    store: shortcutStore,
    commands,
    guard: inimarkShortcutGuard,
    alwaysAllowed: ALWAYS_ALLOWED,
    treeScopedIds: TREE_SCOPED_SHORTCUT_IDS,
    isTreeShortcutContext: options.isTreeShortcutContext,
    isFileTreeFocused,
  });
}
