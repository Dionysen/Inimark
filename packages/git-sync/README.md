# @dionysen/git-sync

GitHub / Gitee login + Pure Writer `.pwb` backup sync for Dionysen desktop apps.

Separate from `@dionysen/cloud-sync` (Aliyun). Vault path: `com.dionysen.git-sync`.

## User flow

1. Sign in with GitHub or Gitee
2. Choose a **private repo name** and click **Create repo & push** (first init)
3. **Sync now** — export open library as `.pwb` and append-upload (status shown bottom-left)
4. **Restore backup** — pick a remote snapshot, then **Merge** or **Overwrite**

## Setup OAuth apps (app developer only)

### GitHub

1. Create an OAuth App at https://github.com/settings/developers
2. Callback URLs: `vellum://git-oauth/callback` and `http://127.0.0.1:39247/git-oauth/callback`
3. Scope: `repo`
4. Put `clientId` in `apps/vellum/src/git-sync/config.ts`

### Gitee

Same callbacks; also set `clientSecret`. Scope: `user_info projects projects_member`.

Empty `clientId` disables that provider’s login button.
