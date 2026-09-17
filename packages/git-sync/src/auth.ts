import {
  codeChallengeS256,
  generateCodeVerifier,
  generateState,
} from "./pkce.ts";
import type {
  GitProvider,
  GitSyncAppConfig,
  SessionSummary,
  SyncResult,
} from "./types.ts";
import {
  gsBeginOauth,
  gsCompleteOauth,
  gsEnsureRepo,
  gsGetSession,
  gsListRemoteBackups,
  gsLogout,
  gsOpenOauthLogin,
  gsOpenUrl,
  gsSyncNow,
  pwGitSyncNow,
} from "./tauri-bridge.ts";

export const LOCAL_GIT_OAUTH_REDIRECT_URI =
  "http://127.0.0.1:39247/git-oauth/callback";

export const OAUTH_SESSION_EVENT = "git-sync-session-changed";
export const OAUTH_ERROR_EVENT = "git-sync-oauth-error";

export interface LoginOptions {
  useSystemBrowser?: boolean;
}

function providerConfig(config: GitSyncAppConfig, provider: GitProvider) {
  return provider === "github" ? config.github : config.gitee;
}

export function isProviderConfigured(
  config: GitSyncAppConfig,
  provider: GitProvider,
): boolean {
  return Boolean(providerConfig(config, provider).clientId.trim());
}

export async function login(
  config: GitSyncAppConfig,
  provider: GitProvider,
  options: LoginOptions = {},
): Promise<{ authorizeUrl: string; state: string }> {
  const pc = providerConfig(config, provider);
  if (!pc.clientId.trim()) {
    throw new Error(`${provider} client_id is not configured`);
  }
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeS256(codeVerifier);
  const state = generateState();
  const redirectUri = options.useSystemBrowser
    ? pc.redirectUri
    : (pc.inAppRedirectUri ?? LOCAL_GIT_OAUTH_REDIRECT_URI);
  const scope =
    pc.scope ??
    (provider === "github" ? "repo" : "user_info projects projects_member");
  const { authorizeUrl } = await gsBeginOauth({
    appId: config.appId,
    provider,
    clientId: pc.clientId,
    clientSecret: pc.clientSecret ?? null,
    redirectUri,
    codeVerifier,
    codeChallenge,
    state,
    scope,
  });
  if (options.useSystemBrowser) {
    await gsOpenUrl(authorizeUrl);
  } else {
    await gsOpenOauthLogin(authorizeUrl);
  }
  return { authorizeUrl, state };
}

export function parseOauthCallbackUrl(
  url: string,
): { code: string; state: string } | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (!code || !state) return null;
    return { code, state };
  } catch {
    const q = url.indexOf("?");
    if (q < 0) return null;
    const params = new URLSearchParams(url.slice(q + 1));
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return null;
    return { code, state };
  }
}

export function completeLoginFromCallback(url: string): Promise<SessionSummary | null> {
  const parsed = parseOauthCallbackUrl(url);
  if (!parsed) return Promise.resolve(null);
  return gsCompleteOauth(parsed);
}

export function getSession(appId: string): Promise<SessionSummary> {
  return gsGetSession(appId);
}

export function logout(appId: string): Promise<SessionSummary> {
  return gsLogout(appId);
}

export function ensureRepo(appId: string): Promise<SessionSummary> {
  return gsEnsureRepo(appId);
}

export function listRemoteBackups(appId: string) {
  return gsListRemoteBackups(appId);
}

export function syncOpenLibrary(appId: string): Promise<SyncResult> {
  return pwGitSyncNow(appId);
}

export function syncLibraryPath(
  appId: string,
  libraryRoot: string,
): Promise<SyncResult> {
  return gsSyncNow(appId, libraryRoot);
}

export type {
  GitProvider,
  GitSyncAppConfig,
  ProviderConfig,
  RemoteBackupInfo,
  SessionSummary,
  SyncResult,
} from "./types.ts";
