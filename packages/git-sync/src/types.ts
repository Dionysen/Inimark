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

export interface SyncResult {
  pulled: number;
  pushed: boolean;
  pruned: number;
  merge?: {
    foldersUpserted: number;
    categoriesUpserted: number;
    articlesUpserted: number;
    settingsUpserted: number;
    sources: number;
    changed: boolean;
  } | null;
  remoteBackupCount: number;
}

export interface RemoteBackupInfo {
  path: string;
  size?: number | null;
}
