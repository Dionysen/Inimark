---
title: FAQ and Troubleshooting
lang: en
translationKey: faq
---

# FAQ and Troubleshooting

**中文:** [[常见问题|中文]] · [[Install Inimark]] · [[MOC-English Docs]]

Short answers first. Deep dives link out.

## Install and launch

### macOS says the app is damaged / cannot be opened

Download again from [Releases](https://github.com/Dionysen/Inimark/releases). If Gatekeeper blocks an unsigned build, open **System Settings → Privacy & Security** and allow it, or right-click → Open the first time. Details: [[Install Inimark]].

### Windows SmartScreen warns on the installer

Choose **More info → Run anyway** when you trust the GitHub release asset. Prefer the Latest release.

### How do I change the UI language?

**Settings → Appearance → Locale**: `en`, `zh-CN`, or follow the system. Help notes are a separate bilingual tree — switching UI language does not auto-switch which note you are reading.

## Libraries and files

### I opened the wrong folder

Add or switch libraries under **Settings → Libraries**, or open another folder. Each library keeps its own `.inimark/` session — see [[Libraries and Files]] and [[Data Directory]].

### Why don’t images appear in the file tree?

The tree lists Markdown notes. Images still embed when linked; manage them on disk. See [[Images and Attachments]].

### Rename broke my wikilinks

Check **Settings → Editor → link update on move** (`ask` / `always` / `never`). With `never`, you must edit links yourself. See [[Wikilinks and Embeds#Rename and rewrite]].

## Editing

### Markup won’t hide / everything looks like source

You may be in [[Editing Modes#Source mode|source mode]]. Press `Ctrl/⌘ + /` to return to WYSIWYG.

### Focus / typewriter

- **Focus** (dim inactive blocks): `F8` while the editor is focused (session toggle).
- **Typewriter**: `F9`, status bar, or Settings → Editor.

### Find vs Search

| Shortcut | Scope |
| --- | --- |
| `Ctrl/⌘ + F` | Current note |
| `Ctrl/⌘ + Shift + F` | Whole library (filename + content substring) |

No search operators yet — plain substring, case-insensitive in vault Search.

### Regex replace examples (in-note)

| Goal | Pattern idea |
| --- | --- |
| Old heading prefix | `^## Draft:` → `## ` |
| Trailing spaces | enable trim-on-save instead when possible |
| Simple wiki rename leftover | `\[\[Old Name` → `[[New Name` (review each hit) |

Always prefer the rename+rewrite pipeline for real note renames.

## Wikilinks and graph

### Link is red / dashed and won’t open

Unresolved target — create the note (autocomplete can help) or fix the title. See [[Wikilinks and Embeds]].

### Graph looks empty

Local mode only shows neighbors of the **active** note. Switch to **vault** mode, or add more `[[links]]`. Densify from an MOC first.

### Can I use `#tags` / block refs like Obsidian?

Not as a first-class system yet — see [[Roadmap]].

## Publish

### Preview is blank or CSS missing

Wrong `baseHref` is the usual cause. Root host → `/`; GitHub project Pages → `/RepoName/` (this docs site uses `/Inimark/`). See [[Publish a Site]].

### Some notes don’t appear on the multilingual site

With `locales`, only notes under a language `root` are published. Notes outside those roots are skipped.

### Site search?

Not built yet. Use the desktop Search tab while editing; track site search under [[Roadmap]].

## Data and safety

### Can I delete `.inimark/link-index.json`?

Yes — the app can rebuild it. Do not hand-edit it as a database. See [[Data Directory]].

### Should `.inimark/` be in git?

Optional. Session/recents are personal; bookmarks may be worth sharing. Prefer not committing huge accidental `dist/` trees.

---

Still stuck? Skim [[Roadmap]] for “not a bug, not shipped”, or open an issue on the GitHub repository.
