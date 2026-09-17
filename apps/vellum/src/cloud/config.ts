import type { CloudSyncAppConfig } from "@dionysen/cloud-sync";
import { LOCAL_OAUTH_REDIRECT_URI } from "@dionysen/cloud-sync";

/** Vellum China-site OAuth app (Native, no client secret). */
export const VELLUM_CLOUD_SYNC: CloudSyncAppConfig = {
  appId: "vellum",
  clientId: "4062933289650685453",
  redirectUri: "vellum://oauth/callback",
  inAppRedirectUri: LOCAL_OAUTH_REDIRECT_URI,
  region: "cn",
  scope: "openid aliuid profile",
};

export const CLOUD_SYNC_CHANGED_EVENT = "vellum:cloud-sync-changed";

export function emitCloudSyncChanged(): void {
  document.dispatchEvent(new CustomEvent(CLOUD_SYNC_CHANGED_EVENT));
}
