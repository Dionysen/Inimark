# @dionysen/git-sync

GitHub / Gitee login + automatic Pure Writer `.pwb` backup sync for Dionysen desktop apps.

Separate from `@dionysen/cloud-sync` (Aliyun). Vault path: `com.dionysen.git-sync`.

## Setup OAuth apps

### GitHub

1. Create an OAuth App at https://github.com/settings/developers
2. Authorization callback URL: `vellum://git-oauth/callback`
3. Also register (for in-app webview): `http://127.0.0.1:39247/git-oauth/callback`
4. Scope used: `repo`
5. Put `clientId` into Vellum `git-sync/config.ts` (`github.clientId`)

### Gitee

1. Create a third-party application at https://gitee.com/oauth/applications
2. Same callback URIs as above
3. Scope: `user_info projects projects_member` (adjust as needed)
4. Fill `clientId` and `clientSecret` in config

Empty `clientId` disables that provider’s login button.

## User flow

1. Sign in with GitHub or Gitee
2. App creates private repo `vellum-pwb-sync` if missing
3. Sync pulls `backups/*.pwb`, merges into the open library (field-level LWW), then appends a new `.pwb` snapshot when local data changed
4. Keeps at most 50 remote backups
