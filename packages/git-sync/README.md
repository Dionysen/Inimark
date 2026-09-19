# @dionysen/git-sync

GitHub / Gitee login + Pure Writer `.pwb` backup sync for Dionysen desktop apps.

Vault path: `com.dionysen.git-sync`.

## User flow

1. Sign in with GitHub or Gitee
2. Choose a **private repo name** and click **Create repo & push** (first init)
3. Edits are saved into the open library immediately. Every 5 minutes the app writes a local `.pwb` under `App/Backups`.
4. Quitting closes the app first. A background process uploads the cloud backup, then posts a system notification. If the upload fails, retry or stop.
5. **Sync now**, or the button at the lower left of the editor, uploads in the background. The button turns into a spinner; writing and the rest of Settings stay available. **Restore backup** picks a remote snapshot, then **Merge** or **Overwrite**.

## Setup OAuth apps (app developer only)

### GitHub

1. Create an OAuth App at https://github.com/settings/developers
2. Callback URLs: `vellum://git-oauth/callback` and `http://127.0.0.1:39247/git-oauth/callback`
3. Scope: `repo`
4. Put `clientId` in `apps/vellum/src/git-sync/config.ts`

### Gitee

Same callbacks; also set `clientSecret`. Scope: `user_info projects`.

Empty `clientId` disables that provider’s login button.
