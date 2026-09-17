# Vellum — Pure Writer compatibility

Vellum can open a Pure Writer desktop folder (the directory that contains `App/Room.db`) as its document library.

## Usage

1. Launch Vellum.
2. Paste the library path (e.g. `C:\Users\...\Documents\PureWriter`) and click **Open**.
3. Select a folder / article; edit in the plaintext surface; **Save** writes back to `Room.db`.

## Cloud sync (GitHub / Gitee)

Vellum can sign in with **GitHub** or **Gitee**. After login it creates (or reuses) a private repo `vellum-pwb-sync` and syncs Pure Writer `.pwb` backups:

1. Pull remote `backups/*.pwb`
2. Merge into the open library (field-level last-write-wins on Room.db timestamps)
3. Append a new `.pwb` snapshot when local data changed
4. Keep at most 50 remote backups

Configure OAuth `clientId` (and Gitee `clientSecret`) in `apps/vellum/src/git-sync/config.ts`. See `packages/git-sync/README.md`.

Tokens live in an encrypted vault under `com.dionysen.git-sync` (separate from the unused Aliyun `com.dionysen.cloud-sync` module).

This is **not** Pure Writer’s official cloud sync protocol. Sync-related timestamp fields in `Room.db` are preserved so the official app can reconcile if you use it separately.

## Schema mismatch

If Pure Writer upgrades its Room schema, Vellum opens **read-only** until you edit `App/.vellum-purewriter.json` (see `crates/purewriter-store/README.md`).

## Safety

- Do not run Pure Writer and Vellum against the same library at the same time (`.vellum-lock`).
- Cloud sync protocol is not reimplemented; sync-related timestamp fields are preserved on write so the official app can still reconcile.
