---
title: Libraries and Files
lang: en
translationKey: libraries-files
---

# Libraries and Files

**中文:** [[库与文件|中文]] · [[Wikilinks and Embeds]] · [[MOC-English Docs]]

## What is a library?

A library ≈ an Obsidian vault: a **local folder** of Markdown (and assets on disk).

Inimark supports **multiple libraries**. Switch or manage them under **Settings → Libraries**, or open / drop another folder.

> [!IMPORTANT]
> This help site’s source *is* the repo’s `docs/` folder — open it as a library.

### Create or switch

1. **Open folder** (shortcut often `Ctrl/⌘ + Shift + O`) or drop a folder onto the app.
2. The folder is upserted into the library list; the last opened library is remembered.
3. Switch later from the library list in the shell / Settings → Libraries.

Each library keeps its own session (active file, expanded folders, caret / scroll / source mode) under `.inimark/` — see [[Data Directory]].

## What appears in the file tree

| Shown | Not shown as rows |
| --- | --- |
| `.md` / `.markdown` / `.mdown` notes | Image and other binary files |
| Folders you create | Dotfiles / dot-folders (names starting with `.`) |

Images still embed when linked — organize them on disk and see [[Images and Attachments]].

## File tree (Files)

| Action | Notes |
| --- | --- |
| Create | Notes / folders |
| Rename | May trigger link rewrite (`F2`) |
| Delete | Confirmed (`Delete`) |
| Move | Drag or cut / paste |
| Reveal | Show the active file in the tree |
| Sort | By name and related rules |

**Drag-and-drop** reorganization is supported. Explorer cut/copy/paste shortcuts apply when the tree is focused.

## Quick Open

Fuzzy name match + recent files — the everyday jumper.

Often bound to the “Open” shortcut (rebind under Shortcuts) → [[Find Replace and Shortcuts]].

## Navigation history

Title-bar **back / forward** moves through visited notes, browser-style — see [[Interface Tour]].

## Session memory

Per library, Inimark remembers view state (caret, scroll, source mode, expanded dirs, …) in files like `.inimark/session.json`.

## Rename and move

When a linked note is renamed or moved, Inimark can rewrite `[[links]]` elsewhere. Policy lives under **Settings → Editor** (link update on move):

| Policy | Behavior |
| --- | --- |
| ask | Prompt each time (safe default) |
| always | Always rewrite (big refactors) |
| never | Never rewrite (full manual control) |

Details: [[Wikilinks and Embeds#Rename and rewrite]].

On a tree rename/move:

1. If links are affected → rewrite by policy (`ask` / `always` / `never`)
2. Otherwise → path update only
3. Link index refreshes afterward

### Suggested multi-library setup

| Library | Example |
| --- | --- |
| Work | Project specs and meeting notes |
| Personal | Journals and reading notes |
| Publish | A vault you intentionally ship (like this `docs/`) |

Keep Publish configs (`publish.config.json`) inside the vault you mean to build.

Next: connect files into a graph → [[Wikilinks and Embeds]] · Scenarios → [[Everyday Workflows]].
