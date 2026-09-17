import { resolveClientId } from "./endpoints.ts";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateState,
} from "./pkce.ts";
import type {
  AppProfileSummary,
  CloudSyncAppConfig,
  OauthRegion,
  SessionSummary,
  SiblingSession,
} from "../vault/types.ts";
import {
  csAdoptSession,
  csBeginOauth,
  csCompleteOauth,
  csEnsureAccessToken,
  csGetProfile,
  csGetSession,
  csListSiblings,
  csLogout,
  csOpenOauthLogin,
  csOpenUrl,
} from "../tauri-bridge.ts";

const DEFAULT_SCOPE = "openid aliuid profile";

/** Event name emitted by the in-app OAuth webview when callback is hit. */
export const OAUTH_CALLBACK_EVENT = "cloud-sync-oauth-callback";

export interface LoginOptions {
  region?: OauthRegion;
  /**
   * Open login in the system browser instead of the in-app window.
   * Prefer the in-app window — Arc/Chrome often render Aliyun login as a blank page.
   */
  useSystemBrowser?: boolean;
}

/**
 * Start Aliyun OAuth. By default opens an in-app login window.
 * Call {@link completeLoginFromCallback} when the callback URL arrives
 * (webview event or deep link).
 */
export async function login(
  config: CloudSyncAppConfig,
  options: LoginOptions = {},
): Promise<{ authorizeUrl: string; browserUrl: string; state: string }> {
  const region = options.region ?? config.region ?? "cn";
  const clientId = resolveClientId(region, config.clientId, config.intlClientId);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeS256(codeVerifier);
  const state = generateState();
  const { authorizeUrl, browserUrl } = await csBeginOauth({
    appId: config.appId,
    clientId,
    redirectUri: config.redirectUri,
    region,
    codeVerifier,
    codeChallenge,
    state,
    scope: config.scope ?? DEFAULT_SCOPE,
  });
  const target = browserUrl || authorizeUrl;
  if (options.useSystemBrowser) {
    await csOpenUrl(target);
  } else {
    await csOpenOauthLogin(target);
  }
  return { authorizeUrl, browserUrl, state };
}

/** Parse `vellum://oauth/callback?code=...&state=...` (or any registered scheme). */
export function parseOauthCallbackUrl(url: string): { code: string; state: string } | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (!code || !state) return null;
    return { code, state };
  } catch {
    // Some platforms deliver custom-scheme URLs that URL() rejects; fall back.
    const q = url.indexOf("?");
    if (q < 0) return null;
    const params = new URLSearchParams(url.slice(q + 1));
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return null;
    return { code, state };
  }
}

export function completeLoginFromCallback(url: string): Promise<AppProfileSummary | null> {
  const parsed = parseOauthCallbackUrl(url);
  if (!parsed) return Promise.resolve(null);
  return csCompleteOauth(parsed);
}

export function getSession(appId: string): Promise<SessionSummary> {
  return csGetSession(appId);
}

export function getProfile(appId: string): Promise<AppProfileSummary> {
  return csGetProfile(appId);
}

export function logout(appId: string, clearOss = false): Promise<AppProfileSummary> {
  return csLogout(appId, clearOss);
}

export function listSiblingSessions(appId: string): Promise<SiblingSession[]> {
  return csListSiblings(appId);
}

export function adoptSession(input: {
  fromAppId: string;
  toAppId: string;
  copyOss?: boolean;
}): Promise<AppProfileSummary> {
  return csAdoptSession(input);
}

export function ensureAccessToken(appId: string): Promise<SessionSummary> {
  return csEnsureAccessToken(appId);
}
