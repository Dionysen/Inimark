import { invoke } from "@tauri-apps/api/core";
import type {
  AppProfileSummary,
  OssConfigInput,
  OssObjectMeta,
  OssObjectSummary,
  SessionSummary,
  SiblingSession,
} from "./vault/types.ts";

export function csBeginOauth(input: {
  appId: string;
  clientId: string;
  redirectUri: string;
  region: string;
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}): Promise<{ authorizeUrl: string; browserUrl: string }> {
  return invoke("cs_begin_oauth", { input });
}

export function csCompleteOauth(input: {
  code: string;
  state: string;
}): Promise<AppProfileSummary> {
  return invoke("cs_complete_oauth", { input });
}

export function csGetSession(appId: string): Promise<SessionSummary> {
  return invoke("cs_get_session", { input: { appId } });
}

export function csGetProfile(appId: string): Promise<AppProfileSummary> {
  return invoke("cs_get_profile", { input: { appId } });
}

export function csLogout(
  appId: string,
  clearOss = false,
): Promise<AppProfileSummary> {
  return invoke("cs_logout", { input: { appId, clearOss } });
}

export function csListSiblings(appId: string): Promise<SiblingSession[]> {
  return invoke("cs_list_siblings", { input: { appId } });
}

export function csAdoptSession(input: {
  fromAppId: string;
  toAppId: string;
  copyOss?: boolean;
}): Promise<AppProfileSummary> {
  return invoke("cs_adopt_session", { input });
}

export function csConfigureOss(
  appId: string,
  config: OssConfigInput,
): Promise<AppProfileSummary> {
  return invoke("cs_configure_oss", { input: { appId, config } });
}

export function csOssList(input: {
  appId: string;
  prefix?: string;
  marker?: string;
  maxKeys?: number;
}): Promise<OssObjectSummary[]> {
  return invoke("cs_oss_list", { input });
}

export function csOssGet(
  appId: string,
  key: string,
): Promise<{ key: string; base64: string }> {
  return invoke("cs_oss_get", { input: { appId, key } });
}

export function csOssPut(input: {
  appId: string;
  key: string;
  base64: string;
  contentType?: string;
}): Promise<void> {
  return invoke("cs_oss_put", { input });
}

export function csOssDelete(appId: string, key: string): Promise<void> {
  return invoke("cs_oss_delete", { input: { appId, key } });
}

export function csOssHead(appId: string, key: string): Promise<OssObjectMeta> {
  return invoke("cs_oss_head", { input: { appId, key } });
}

export function csOpenUrl(url: string): Promise<void> {
  return invoke("cs_open_url", { url });
}

export function csOpenOauthLogin(url: string): Promise<void> {
  return invoke("cs_open_oauth_login", { url });
}

export function csEnsureAccessToken(appId: string): Promise<SessionSummary> {
  return invoke("cs_ensure_access_token", { input: { appId } });
}
