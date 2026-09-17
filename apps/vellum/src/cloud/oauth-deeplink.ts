import {
  completeLoginFromCallback,
  parseOauthCallbackUrl,
} from "@dionysen/cloud-sync";
import { isTauri } from "@dionysen/shell";
import { emitCloudSyncChanged } from "./config.ts";

/**
 * Listen for `vellum://oauth/callback` deep links and finish the OAuth exchange.
 * Safe to call from main and settings windows.
 */
export async function installOauthDeepLinkHandler(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const { invoke } = await import("@tauri-apps/api/core");

  async function handleUrls(urls: string[] | null | undefined): Promise<void> {
    if (!urls?.length) return;
    for (const url of urls) {
      if (!parseOauthCallbackUrl(url)) continue;
      try {
        const profile = await completeLoginFromCallback(url);
        if (!profile) continue;
        emitCloudSyncChanged();
        try {
          await invoke("show_settings_window");
        } catch {
          // Settings may already be focused.
        }
      } catch (err) {
        console.error("OAuth callback failed", err);
      }
    }
  }

  const initial = await getCurrent().catch(() => null);
  await handleUrls(initial);

  const unlisten = await onOpenUrl((urls) => {
    void handleUrls(urls);
  });
  return unlisten;
}
