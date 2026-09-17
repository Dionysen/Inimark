import {
  completeLoginFromCallback,
  OAUTH_CALLBACK_EVENT,
  parseOauthCallbackUrl,
} from "@dionysen/cloud-sync";
import { isTauri } from "@dionysen/shell";
import { emitCloudSyncChanged } from "./config.ts";

async function finishOauthUrl(url: string): Promise<void> {
  if (!parseOauthCallbackUrl(url)) return;
  try {
    const profile = await completeLoginFromCallback(url);
    if (!profile) return;
    emitCloudSyncChanged();
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("show_settings_window");
    } catch {
      // Settings may already be focused.
    }
  } catch (err) {
    console.error("OAuth callback failed", err);
  }
}

/**
 * Listen for OAuth callbacks from:
 * - in-app login webview (`cloud-sync-oauth-callback` event)
 * - OS deep links (`vellum://oauth/callback`)
 */
export async function installOauthDeepLinkHandler(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const cleanups: Array<() => void> = [];

  const { listen } = await import("@tauri-apps/api/event");
  cleanups.push(
    await listen<string>(OAUTH_CALLBACK_EVENT, (event) => {
      void finishOauthUrl(event.payload);
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
