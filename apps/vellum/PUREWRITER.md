# Vellum — Pure Writer compatibility

Vellum can open a Pure Writer desktop folder (the directory that contains `App/Room.db`) as its document library. Opening validates the folder: if `App/Room.db` is missing, the open fails with a clear error.

## Hierarchy

Vellum presents Pure Writer data as **book → volume → chapter**:

| Vellum | Pure Writer (`Room.db`) |
|--------|-------------------------|
| Book | Folder |
| Volume | Category |
| Chapter | Article |

Books without volumes still work: chapters with no category appear under **Uncategorized**.

## Usage

1. Launch Vellum. If you opened a library before, it restores that path automatically.
2. Use the floating **library bar** at the bottom of the left sidebar:
   - Click the pill to switch among saved libraries, **Add library**, or **Close library**.
   - Click the **settings** gear to open Settings.
3. Use the **book name** button at the top of the sidebar to switch books. **New** creates a chapter in the selected volume (or Uncategorized).
4. Collapse the sidebar with the toggle in the sidebar top bar (aligned with the titlebar, near the divider). When collapsed, expand it again from the titlebar leading edge (same pattern as Inimark).
5. Expand a volume and click a chapter to edit it. Edits autosave after 0.8s of idle typing; **Ctrl+S** still saves immediately.
6. **Trash** is a book in the book switcher, listed under the others. Deleting a chapter asks first, then moves it into that book. Open Trash to read a chapter or restore it to the book you were just in. Deleting a chapter while Trash is open — or right-clicking Trash and choosing Empty Trash — asks again, in red, because that removal cannot be undone.

Saved libraries (path + name) and the last selected book are remembered locally for the next launch.

## Cloud sync (GitHub / Gitee)

Vellum can sign in with **GitHub** or **Gitee**. After login it creates (or reuses) a private repo and syncs Pure Writer `.pwb` backups:

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
