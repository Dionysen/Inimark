import type { OauthRegion } from "../vault/types.ts";

export interface OauthEndpoints {
  authorize: string;
  token: string;
  revoke: string;
  userinfo: string;
}

const CN: OauthEndpoints = {
  authorize: "https://signin.aliyun.com/oauth2/v1/auth",
  token: "https://oauth.aliyun.com/v1/token",
  revoke: "https://oauth.aliyun.com/v1/revoke",
  userinfo: "https://oauth.aliyun.com/v1/userinfo",
};

const INTL: OauthEndpoints = {
  authorize: "https://signin.alibabacloud.com/oauth2/v1/auth",
  token: "https://oauth.alibabacloud.com/v1/token",
  revoke: "https://oauth.alibabacloud.com/v1/revoke",
  userinfo: "https://oauth.alibabacloud.com/v1/userinfo",
};

export function endpointsFor(region: OauthRegion): OauthEndpoints {
  return region === "intl" ? INTL : CN;
}

export function resolveClientId(
  region: OauthRegion,
  cnClientId: string,
  intlClientId?: string,
): string {
  if (region === "intl") {
    if (!intlClientId) {
      throw new Error("International OAuth clientId is not configured");
    }
    return intlClientId;
  }
  return cnClientId;
}
