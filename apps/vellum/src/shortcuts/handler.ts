import { mountShortcutHandler as mountKitHandler } from "@dionysen/shortcut-kit";
import type { AppShortcutId } from "./store.ts";
import { vellumShortcutGuard } from "./guard.ts";
import { shortcutStore } from "./store.ts";

export type ShortcutCommandHandler = () => void | Promise<void>;
export type ShortcutCommandMap = Partial<
  Record<AppShortcutId, ShortcutCommandHandler>
>;

const ALWAYS_ALLOWED: readonly AppShortcutId[] = ["close", "open-settings"];

export function mountShortcutHandler(
  commands: ShortcutCommandMap,
): () => void {
  return mountKitHandler<AppShortcutId>({
    store: shortcutStore,
    commands,
    guard: vellumShortcutGuard,
    alwaysAllowed: ALWAYS_ALLOWED,
  });
}
