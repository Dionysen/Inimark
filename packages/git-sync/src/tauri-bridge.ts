import type {
  BackupMeta,
  PushResult,
  RestoreResult,
  SessionSummary,
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

export function gsInitRepo(appId: string, repoName: string): Promise<SessionSummary> {
  return invoke("gs_init_repo", { input: { appId, repoName } });
}

export function gsEnsureRepo(appId: string): Promise<SessionSummary> {
  return invoke("gs_ensure_repo", { input: { appId } });
}

export function gsListRemoteBackups(appId: string): Promise<BackupMeta[]> {
  return invoke("gs_list_remote_backups", { input: { appId } });
}

export function pwGitPushNow(appId: string): Promise<PushResult> {
  return invoke("pw_git_push_now", { appId });
}

export function pwGitRestore(
  appId: string,
  remotePath: string,
  mode: "overwrite" | "merge",
): Promise<RestoreResult> {
  return invoke("pw_git_restore", { appId, remotePath, mode });
}
