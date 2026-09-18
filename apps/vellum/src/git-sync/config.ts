import type { GitSyncAppConfig } from "@dionysen/git-sync";
import { LOCAL_GIT_OAUTH_REDIRECT_URI } from "@dionysen/git-sync";

/**
 * OAuth client IDs — leave empty until you create apps on GitHub/Gitee.
 * See packages/git-sync/README.md.
 */
export const VELLUM_GIT_SYNC: GitSyncAppConfig = {
  appId: "vellum",
  github: {
    clientId: "Ov23liU0HjW7hNkyxTOc",
    clientSecret: "b776a5a871c069b18ab6fb9b968e3dc10b96fb06",
    redirectUri: "vellum://git-oauth/callback",
    inAppRedirectUri: LOCAL_GIT_OAUTH_REDIRECT_URI,
    scope: "repo",
  },
  gitee: {
    clientId: "749bbc6dea5130cba0d69679a8790d4eefd08c9a957cd8d39a5d5fa1f896a5b9",
    clientSecret: "66aa08c0df07ceec7b01e118e52f5b30da2455a1a97e718a4e21d80d4722f504",
    redirectUri: "vellum://git-oauth/callback",
    inAppRedirectUri: LOCAL_GIT_OAUTH_REDIRECT_URI,
    scope: "user_info projects projects_member",
  },
};

export const GIT_SYNC_CHANGED_EVENT = "vellum:git-sync-changed";

export function emitGitSyncChanged(): void {
  document.dispatchEvent(new CustomEvent(GIT_SYNC_CHANGED_EVENT));
}
