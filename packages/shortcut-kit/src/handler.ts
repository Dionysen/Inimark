import type { ShortcutStore } from "./store.ts";
import { matchShortcut } from "./store.ts";
import type { createShortcutGuard } from "./guard.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;

export interface MountShortcutHandlerOptions<TAction extends string> {
  store: ShortcutStore;
  commands: Partial<Record<TAction, ShortcutCommandHandler>>;
  guard: ReturnType<typeof createShortcutGuard>;
  /** Action ids that fire even when focus is in an editable field. */
  alwaysAllowed: readonly TAction[];
  /** Action ids that only apply in a tree / explorer context. */
  treeScopedIds?: ReadonlySet<TAction>;
  /** Extra gate for explorer shortcuts when DOM focus left the tree after rerender. */
  isTreeShortcutContext?: () => boolean;
  /** True when focus is inside the files panel tree. */
  isFileTreeFocused?: (target: EventTarget | null) => boolean;
  /** Overlay selectors that suppress app shortcuts while open. */
  blockingOverlaySelector?: string;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function mountShortcutHandler<TAction extends string>(
  options: MountShortcutHandlerOptions<TAction>,
): () => void {
  const {
    store,
    commands,
    guard,
    alwaysAllowed,
    treeScopedIds,
    isTreeShortcutContext,
    isFileTreeFocused,
    blockingOverlaySelector = ".inimark-confirm-dialog, .inimark-quick-open-overlay",
  } = options;

  let shortcuts = store.loadShortcuts();

  const onStorage = (event: StorageEvent) => {
    if (event.key === store.storageKey) {
      shortcuts = store.loadShortcuts();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.repeat) return;
    if (document.querySelector(blockingOverlaySelector)) {
      return;
    }
    if (guard.isShortcutRecordingActive()) return;

    const inEditor = isEditableTarget(event.target);
    for (const binding of shortcuts) {
      const keys = store.getShortcutKeys(shortcuts, binding.id);
      if (!matchShortcut(event, keys)) continue;
      const id = binding.id as TAction;
      const handler = commands[id];
      if (!handler) continue;

      if (treeScopedIds?.has(id)) {
        const inTree =
          Boolean(isFileTreeFocused?.(event.target)) ||
          Boolean(isTreeShortcutContext?.());
        if (!inTree) continue;
      }

      if (inEditor && !alwaysAllowed.includes(id)) {
        continue;
      }

      event.preventDefault();
      event.stopPropagation();
      void handler();
      return;
    }

    guard.blockNativeShortcut(event);
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("storage", onStorage);
  };
}
