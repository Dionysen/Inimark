import { isTauri } from "./env.ts";

/** Open http(s), mailto, tel, etc. in the system handler without navigating the webview. */
export function openExternalUrl(url: string): void {
  void (async () => {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_url", { url });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  })();
}
