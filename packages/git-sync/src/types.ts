export type GitProvider = "github" | "gitee";

export interface ProviderConfig {
  clientId: string;
  /** Required for Gitee; optional for GitHub public apps. */
  clientSecret?: string;
  redirectUri: string;
  inAppRedirectUri?: string;
  scope?: string;
}

export interface GitSyncAppConfig {
  appId: string;
  github: ProviderConfig;
  gitee: ProviderConfig;
}

export interface SessionSummary {
  loggedIn: boolean;
  provider?: string | null;
  login?: string | null;
  name?: string | null;
  repoFullName?: string | null;
  lastSyncAt?: number | null;
  configured: boolean;
}

export interface PushResult {
  path: string;
  remoteBackupCount: number;
  pruned: number;
}

export interface BackupMeta {
  path: string;
  deviceId: string;
  createdAt: string;
  size: number;
  articleCount: number;
  wordCount: number;
}

export interface RestoreResult {
  mode: string;
  merge?: {
    foldersUpserted: number;
    categoriesUpserted: number;
    articlesUpserted: number;
    settingsUpserted: number;
    sources: number;
    changed: boolean;
  } | null;
}

export type SyncStatusState = "idle" | "syncing" | "error" | "ok";

export interface SyncStatusPayload {
  state: SyncStatusState | string;
  message?: string | null;
  error?: string | null;
}
