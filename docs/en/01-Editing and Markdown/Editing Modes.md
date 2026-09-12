---
title: Editing Modes
lang: en
translationKey: editing-modes
---

# Editing Modes

**中文:** [[编辑模式|中文]] · [[MOC-English Docs]]

Inimark’s editing idea is simple:

> **One surface, two depths** — by default you read a typeset page; when needed, Markdown source appears.

## WYSIWYG

Default mode (Typora-style):

- The active line / span shows markup (`**`, `#`, `[[`…)
- When the caret leaves, marks hide and only formatting remains
- There is **no** split-pane “live preview” — the preview *is* the editor

> [!TIP]
> Coming from classic left-MD / right-HTML editors? Spend a day in WYSIWYG only. Most people enter flow faster. See [[Feature Comparison]].

Example:

> A quote with **emphasis** and ==highlight==.
>
> Or a callout:

> [!NOTE]
> Callouts are covered in [[Markdown Syntax#Callouts|Markdown Syntax]].

### When WYSIWYG shines

- Drafting prose, outlines, and meeting notes
- Light formatting while reading your own words
- Following wikilinks without leaving the typeset view

### Paste behavior

- Normal paste may carry rich text from the clipboard.
- **Paste as plain text** (`Ctrl/⌘ + Shift + V`) keeps indentation honest — preferred for code and CLI logs.

## Source mode

Shortcut: `Ctrl + /` (macOS: `⌘ + /`)

| Trait | Detail |
| --- | --- |
| Engine | CodeMirror |
| Line numbers | Yes |
| Best for | Structural edits, messy pastes, debugging markup |

Switching back re-folds the document into the typeset view.

### When to flip to source

| Situation | Why source helps |
| --- | --- |
| Large Mermaid / KaTeX blocks | Edit raw fences without widget chrome |
| Broken tables after a paste | See pipes and rows clearly |
| Front matter / HTML comments | Precise character-level control |
| Mystery formatting | Hunt stray markers |

## Typewriter mode

Keeps the **current line near vertical center** to reduce vertical eye travel — great for long notes.

- Enable under **Settings → Editor**
- Toggle with **`F9`** or the **status bar** (see [[Interface Tour]])

Persists in settings when changed from the Editor section.

## Focus mode

Dims blocks away from the caret so the active paragraph stands out.

- Enable under **Settings → Editor**
- Toggle from **More → Immersive editing**
- Or press **`F8`** while the editor is focused

Persists in settings (same as typewriter).

Combine with auto-hidden title/status bars for a near-paper canvas — [[Themes and Appearance]].

## Mode matrix

| Mode | Maturity | Entry |
| --- | --- | --- |
| WYSIWYG | ✅ | Default |
| Source | ✅ | `Ctrl/⌘+/` |
| Typewriter | ✅ | `F9` / Settings / status bar |
| Focus | ✅ | `F8` / Settings / More → Immersive |

Related: [[Markdown Syntax]] · [[Find Replace and Shortcuts]] · [[Math and Diagrams]] · [[Everyday Workflows]]
