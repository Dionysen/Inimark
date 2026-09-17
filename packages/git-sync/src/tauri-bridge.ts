import type {
  RemoteBackupInfo,
  SessionSummary,
  SyncResult,
} from "./types.ts";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

export function gsBeginOauth(input: Record<string, unknown>): Promise<{ authorizeUrl: string }> {
  return invoke("gs_begin_oauth", { input });
}

export function gsCompleteOauth(input: {
  code: string;
  state: string;
}): Promise<SessionSummary> {
  return invoke("gs_complete_oauth", { input });
}

export function gsGetSession(appId: string): Promise<SessionSummary> {
  return invoke("gs_get_session", { input: { appId } });
}

export function gsLogout(appId: string): Promise<SessionSummary> {
  return invoke("gs_logout", { input: { appId } });
}

export function gsOpenOauthLogin(url: string): Promise<void> {
  return invoke("gs_open_oauth_login", { url });
}

export function gsOpenUrl(url: string): Promise<void> {
  return invoke("gs_open_url", { url });
}

export function gsEnsureRepo(appId: string): Promise<SessionSummary> {
  return invoke("gs_ensure_repo", { input: { appId } });
}

export function gsListRemoteBackups(appId: string): Promise<RemoteBackupInfo[]> {
  return invoke("gs_list_remote_backups", { input: { appId } });
}

/** Prefer this when a Pure Writer library is already open in Vellum. */
export function pwGitSyncNow(appId: string): Promise<SyncResult> {
  return invoke("pw_git_sync_now", { appId });
}

export function gsSyncNow(appId: string, libraryRoot: string): Promise<SyncResult> {
  return invoke("gs_sync_now", { input: { appId, libraryRoot } });
}
