import { mountShortcutHandler as mountKitHandler } from "@dionysen/shortcut-kit";
import type { AppShortcutId } from "./store.ts";
import { TREE_SCOPED_SHORTCUT_IDS } from "./store.ts";
import { vellumShortcutGuard } from "./guard.ts";
import { shortcutStore } from "./store.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;
export type ShortcutCommandMap = Partial<
  Record<AppShortcutId, ShortcutCommandHandler>
>;

const ALWAYS_ALLOWED: readonly AppShortcutId[] = [
  "save",
  "new-chapter",
  "close",
  "quit",
  "open-settings",
  "toggle-sidebar",
  "tree-rename",
];

/** True when focus is inside the library tree (not the writing surface). */
export function isLibraryTreeFocused(
  target: EventTarget | null = document.activeElement,
): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return false;
  return Boolean(el.closest(".vellum-library-tree"));
}

export function mountShortcutHandler(
  commands: ShortcutCommandMap,
): () => void {
  return mountKitHandler<AppShortcutId>({
    store: shortcutStore,
    commands,
    guard: vellumShortcutGuard,
    alwaysAllowed: ALWAYS_ALLOWED,
    treeScopedIds: TREE_SCOPED_SHORTCUT_IDS,
    isFileTreeFocused: isLibraryTreeFocused,
  });
}
