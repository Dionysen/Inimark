/** Shared vault / session types mirrored from the Rust crate (camelCase IPC). */

export type OauthRegion = "cn" | "intl";

export interface SessionSummary {
  loggedIn: boolean;
  uid?: string | null;
  aid?: string | null;
  loginName?: string | null;
  name?: string | null;
  region?: string | null;
  expiresAt?: number | null;
}

export interface SiblingSession {
  appId: string;
  uid?: string | null;
  loginName?: string | null;
  name?: string | null;
  region?: string | null;
}

export interface OssConfigPublic {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  prefix: string;
}

export interface AppProfileSummary {
  appId: string;
  loggedIn: boolean;
  uid?: string | null;
  loginName?: string | null;
  name?: string | null;
  region?: string | null;
  hasOss: boolean;
  oss?: OssConfigPublic | null;
  updatedAt: number;
}

export interface OssConfigInput {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  prefix?: string;
}

export interface OssObjectSummary {
  key: string;
  size: number;
  lastModified?: string | null;
  etag?: string | null;
}

export interface OssObjectMeta {
  key: string;
  size?: number | null;
  contentType?: string | null;
  etag?: string | null;
  lastModified?: string | null;
}

export interface CloudSyncAppConfig {
  /** Vault profile key, e.g. `"vellum"`. */
  appId: string;
  clientId: string;
  redirectUri: string;
  region?: OauthRegion;
  /** Intl client id when dual-region is enabled later. */
  intlClientId?: string;
  scope?: string;
}
