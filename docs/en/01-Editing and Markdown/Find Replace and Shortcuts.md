---
title: Find Replace and Shortcuts
lang: en
translationKey: find-replace
---

# Find, Replace, and Shortcuts

**中文:** [[查找替换与快捷键|中文]] · [[Editing Modes]] · [[Settings Overview]]

## Find and replace (current note)

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Find | `Ctrl + F` | `⌘ + F` |
| Replace | `Ctrl + H` | `⌘ + H` |

Find bar supports:

- [x] Match case
- [x] Whole word
- [x] Regular expressions
- [x] Previous / next match
- [x] Replace / replace all

> [!TIP]
> Vault-wide search lives in the **Search** tab (`Ctrl/⌘ + Shift + F`) — see [[Search Bookmarks Outline]]. `Ctrl+F` is **in-document** only.

### Regex ideas (in-note only)

| Goal                 | Example pattern | Replace with  |
| -------------------- | --------------- | ------------- |
| Strip a draft prefix | `^## Draft:\s*` | `## `         |
| Normalize a label    | `TODO:`         | `Next:`       |
| Cautious wiki stub   | `\[\[Old Title` | `[[New Title` |

Review each hit. For real file renames, use the tree rename + link-rewrite policy instead of regex.

## Three search scopes

| Scope | Entry | Matches |
| --- | --- | --- |
| Current note | `Ctrl/⌘ + F` | Text / regex in the open file |
| Whole library | `Ctrl/⌘ + Shift + F` | Case-insensitive substring in **names and contents** (no operators) |
| Quick Open | often `Ctrl/⌘ + O` | Fuzzy **filenames** + recents |

## Editor shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Bold | `Ctrl + B` | `⌘ + B` |
| Italic | `Ctrl + I` | `⌘ + I` |
| Underline | `Ctrl + U` | `⌘ + U` |
| Inline code | `Ctrl + Shift + \`` | `⌘ + Shift + \`` |
| Strikethrough | `Alt + Shift + 5` | `Alt + Shift + 5` |
| Link | `Ctrl + K` | `⌘ + K` |
| Heading 1–6 | `Ctrl + 1…6` | `⌘ + 1…6` |
| Paragraph | `Ctrl + 0` | `⌘ + 0` |
| Heading level − / + | `Ctrl + =` / `Ctrl + -` | `⌘ + =` / `⌘ + -` |
| Source mode | `Ctrl + /` | `⌘ + /` |
| Focus mode | `F8` | `F8` |
| Typewriter | `F9` | `F9` |
| Paste plain | `Ctrl + Shift + V` | `⌘ + Shift + V` |
| Hard break | `Shift + Enter` | `Shift + Enter` |

### Block inserts (`Alt` chords)

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Bullet list | `Alt + Ctrl + U` | `Alt + ⌘ + U` |
| Ordered list | `Alt + Ctrl + O` | `Alt + ⌘ + O` |
| Task list | `Alt + Ctrl + X` | `Alt + ⌘ + X` |
| Blockquote | `Alt + Ctrl + Q` | `Alt + ⌘ + Q` |
| Code block | `Alt + Ctrl + C` | `Alt + ⌘ + C` |
| Math block | `Alt + Ctrl + B` | `Alt + ⌘ + B` |
| Footnote mark | `Alt + Ctrl + R` | `Alt + ⌘ + R` |
| Horizontal rule | `Alt + Ctrl + -` | `Alt + ⌘ + -` |
| Table | `Alt + Ctrl + T` | `Alt + ⌘ + T` |

Table row/column moves: `Alt + Ctrl/⌘ + Arrow` (platform variants exist). Exact bindings always win in **Settings → Shortcuts** when rebound.

## App shortcuts (rebindable)

Defaults under **Settings → Shortcuts**:

| Action | Default (Ctrl = ⌘ on macOS) |
| --- | --- |
| Save | `Ctrl + S` |
| Save As | `Ctrl + Shift + S` |
| New file | `Ctrl + N` |
| Quick Open / Open | `Ctrl + O` |
| Open folder | `Ctrl + Shift + O` |
| Close | `Ctrl + W` |
| Toggle sidebar | `Ctrl + B` |
| Search in files | `Ctrl + Shift + F` |
| Open settings | `Ctrl + ,` |
| Tree rename | `F2` |
| Tree delete | `Delete` |
| Tree cut / copy / paste | `Ctrl + X` / `C` / `V` (when the tree is focused) |

> [!NOTE]
> “Open” in Inimark is often **Quick Open** (fuzzy note picker), not the OS file dialog. See [[Libraries and Files]].

## Font zoom

`Ctrl/⌘ + mouse wheel` zooms editor font size — handy for long reads.

## Mental model

- **Current note** — `Ctrl/⌘+F` find · `B` / `I` / `K` format
- **Current library** — Quick Open · sidebar Search
- **App** — Settings · toggle sidebar

Rebind keys → [[Settings Overview]] · Learn markup → [[Markdown Syntax]] · Stuck? [[FAQ and Troubleshooting]].
