# Vellum — Pure Writer compatibility

Vellum can open a Pure Writer desktop folder (the directory that contains `App/Room.db`) as its document library.

## Usage

1. Launch Vellum.
2. Paste the library path (e.g. `C:\Users\...\Documents\PureWriter`) and click **Open**.
3. Select a folder / article; edit in the plaintext surface; **Save** writes back to `Room.db`.

## Schema mismatch

If Pure Writer upgrades its Room schema, Vellum opens **read-only** until you edit `App/.vellum-purewriter.json` (see `crates/purewriter-store/README.md`).

## Safety

- Do not run Pure Writer and Vellum against the same library at the same time (`.vellum-lock`).
- Cloud sync protocol is not reimplemented; sync-related timestamp fields are preserved on write so the official app can still reconcile.
