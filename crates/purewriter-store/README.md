# Pure Writer Store

Local full-fidelity access to Pure Writer libraries (`App/Room.db`) and `.pwb` backups.

## Scope

- **Does:** Folder / Category / Article CRUD, Setting / Shortcut / Daily / History, Scrolls / TabArticleIds / FolderViewStates, PWB pack/unpack, exclusive `.vellum-lock`.
- **Does not:** Official cloud sync protocol; simultaneous open with Pure Writer on the same `Room.db`.

## Schema gate

Baseline fingerprint (Room v27):

- `user_version = 27`
- `identity_hash = af22c7c534a04acc4530d670ac9e43c4`

On mismatch the library opens **read-only**. To allow writes, create `App/.vellum-purewriter.json`:

```json
{
  "schemaOverride": {
    "allowWriteOnMismatch": false,
    "acceptedFingerprints": [
      { "userVersion": 27, "identityHash": "your-new-hash-here" }
    ]
  }
}
```

Or set `"allowWriteOnMismatch": true` temporarily.

## Tests

```bash
cargo test -p purewriter-store
```

Fixtures are synthetic (never commit personal `Room.db`).
