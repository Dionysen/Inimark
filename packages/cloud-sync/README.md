# @dionysen/cloud-sync

Shared Aliyun login + user-owned OSS helpers for Dionysen desktop apps.

## What it does

- **OAuth (Native + PKCE)**: open the system browser, handle deep-link callback, store tokens in an encrypted vault.
- **OSS**: configure endpoint / bucket / AccessKey and call list / get / put / delete / head.
- **Cross-app**: profiles live under `com.dionysen.cloud-sync`; apps can offer one-click adopt of another app’s OAuth session (not shared by default).

OAuth scopes (`openid` / `aliuid` / `profile`) identify the user. They do **not** grant OSS access — users still supply their own AccessKey.

## Apps wire

1. Depend on `dionysen-cloud-sync` (Rust) and `@dionysen/cloud-sync` (TS).
2. Register Tauri commands + `CloudSyncState`.
3. Configure `tauri-plugin-deep-link` with your scheme (e.g. `vellum`).
4. Call `login(config)` then `completeLoginFromCallback(url)` from the deep-link handler.

Vellum China OAuth example (injected by the app, not hard-coded in this package’s runtime defaults):

- `clientId`: your RAM Native app id
- `redirectUri`: `vellum://oauth/callback`
