import {
  completeLoginFromCallback,
  OAUTH_CALLBACK_EVENT,
  OAUTH_ERROR_EVENT,
  OAUTH_SESSION_EVENT,
  parseOauthCallbackUrl,
  type AppProfileSummary,
} from "@dionysen/cloud-sync";
import { isTauri } from "@dionysen/shell";
import { emitCloudSyncChanged } from "./config.ts";

async function finishOauthUrl(url: string): Promise<void> {
  if (!parseOauthCallbackUrl(url)) return;
  try {
    const profile = await completeLoginFromCallback(url);
    if (!profile) return;
    emitCloudSyncChanged();
    await focusSettings();
  } catch (err) {
    console.error("OAuth callback failed", err);
    document.dispatchEvent(
      new CustomEvent("vellum:cloud-sync-error", { detail: String(err) }),
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

/**
 * Listen for OAuth callbacks from:
 * - Rust completing in-app webview login (`cloud-sync-session-changed`)
 * - callback URL events / OS deep links
 */
export async function installOauthDeepLinkHandler(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const cleanups: Array<() => void> = [];

  const { listen } = await import("@tauri-apps/api/event");
  cleanups.push(
    await listen<AppProfileSummary>(OAUTH_SESSION_EVENT, () => {
      emitCloudSyncChanged();
      void focusSettings();
    }),
  );
  cleanups.push(
    await listen<string>(OAUTH_ERROR_EVENT, (event) => {
      console.error("OAuth error", event.payload);
      document.dispatchEvent(
        new CustomEvent("vellum:cloud-sync-error", { detail: event.payload }),
      );
    }),
  );
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
