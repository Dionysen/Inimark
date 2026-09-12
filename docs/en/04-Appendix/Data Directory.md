---
title: Data Directory
lang: en
translationKey: data-directory
---

# Data Directory

**中文:** [[数据目录|中文]] · [[Libraries and Files]] · [[Publish a Site]]

## App-level (approximate)

| Store | Contents |
| --- | --- |
| `localStorage` | App settings, shortcuts, library list, … |

> Exact keys vary by version; prefer the Settings UI over hand-editing storage.

## Per-library: `.inimark/`

Under each library root:

| File | Role | Safe to delete? |
| --- | --- | --- |
| `bookmarks.json` | Bookmarks and groups | Yes — you lose pins |
| `session.json` | Open files, caret/scroll, source mode, expanded dirs | Yes — session resets |
| `recent.json` | Recents | Yes — recents clear |
| `link-index.json` | Wikilink index cache | Yes — app rebuilds it |

Typical library root layout:

- `*.md` and assets
- `.inimark/`
  - `bookmarks.json`
  - `session.json`
  - `recent.json`
  - `link-index.json`
- `publish.config.json`
- `dist/` (build output)

> [!DANGER]
> `link-index.json` can be rebuilt by the app. **Do not** treat it as a hand-written database.

### Git tips

| Path | Suggestion |
| --- | --- |
| Notes + assets | Commit |
| `publish.config.json` | Commit |
| `.inimark/bookmarks.json` | Optional (nice for shared hubs) |
| `.inimark/session.json` / `recent.json` | Usually ignore (personal) |
| `link-index.json` | Optional; rebuildable |
| `dist/` | Ignore — build artifact |

## Extra files in this help vault

| Path | Role |
| --- | --- |
| `publish.config.json` | Publish config (optional `locales`) |
| `README.md` | Bilingual portal |
| `zh/` · `en/` | Parallel doc trees |
| `snippets/` · `片段/` | Embeddable cards |
| `dist/` | Build output (usually ignored via global `dist/`) |

Related: [[Publish a Site]] · [[Wikilinks and Embeds]] · [[FAQ and Troubleshooting]]
