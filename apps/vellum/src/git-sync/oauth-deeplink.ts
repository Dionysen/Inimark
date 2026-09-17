import {
  completeLoginFromCallback,
  OAUTH_ERROR_EVENT,
  OAUTH_SESSION_EVENT,
  parseOauthCallbackUrl,
  type SessionSummary,
} from "@dionysen/git-sync";
import { isTauri } from "@dionysen/shell";
import { emitGitSyncChanged } from "./config.ts";

async function finishOauthUrl(url: string): Promise<void> {
  if (!parseOauthCallbackUrl(url)) return;
  try {
    const session = await completeLoginFromCallback(url);
    if (!session) return;
    emitGitSyncChanged();
    await focusSettings();
  } catch (err) {
    console.error("Git OAuth callback failed", err);
    document.dispatchEvent(
      new CustomEvent("vellum:git-sync-error", { detail: String(err) }),
    );
  }
}

async function focusSettings(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("show_settings_window");
  } catch {
    // Settings may already be focused.
  }
}

/** Listen for GitHub/Gitee OAuth session events and OS deep links. */
export async function installGitOauthDeepLinkHandler(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const cleanups: Array<() => void> = [];

  const { listen } = await import("@tauri-apps/api/event");
  cleanups.push(
    await listen<SessionSummary>(OAUTH_SESSION_EVENT, () => {
      emitGitSyncChanged();
      void focusSettings();
    }),
  );
  cleanups.push(
    await listen<string>(OAUTH_ERROR_EVENT, (event) => {
      console.error("Git OAuth error", event.payload);
      document.dispatchEvent(
        new CustomEvent("vellum:git-sync-error", { detail: event.payload }),
      );
    }),
  );

  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const initial = await getCurrent().catch(() => null);
  if (initial?.length) {
    for (const url of initial) void finishOauthUrl(url);
  }
  cleanups.push(
    await onOpenUrl((urls) => {
      for (const url of urls) void finishOauthUrl(url);
    }),
  );

  return () => {
    for (const fn of cleanups) fn();
  };
}
