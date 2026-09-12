---
title: Everyday Workflows
lang: en
translationKey: everyday-workflows
---

# Everyday Workflows

**中文:** [[日常场景|中文]] · [[Welcome]] · [[MOC-English Docs]]

Feature pages tell you *what* Inimark can do. This page shows *how people actually use it* — pick the path that matches your week.

> [!TIP]
> Open this `docs/` folder as a library and try each recipe on a disposable note. Muscle memory beats screenshots.

## Long-form writing (essays, reports, chapters)

**Goal:** stay in flow on one surface, with structure always one click away.

1. Start in [[Editing Modes#WYSIWYG|WYSIWYG]]. Type headings with `Ctrl/⌘ + 1…6`.
2. Keep [[Search Bookmarks Outline#Outline|Outline]] on the right so you can jump sections without scrolling blindly.
3. Turn on [[Editing Modes#Typewriter mode|typewriter]] (`F9` or status bar) for long sessions; use [[Editing Modes#Focus mode|focus]] (`F8`, Settings, or More → Immersive) when surrounding blocks distract you.
4. When a paragraph needs messy surgery (pasted HTML, broken tables), flip to [[Editing Modes#Source mode|source]] with `Ctrl/⌘ + /`, fix it, flip back.
5. Bookmark the draft under [[Search Bookmarks Outline#Bookmarks|Bookmarks]] if you leave and return all week.

**Useful habits**

- Prefer short sections over one giant wall of text — Outline and Publish both thank you.
- Use Callouts for asides so the main argument stays clean — see [[Markdown Syntax#Callouts]].
- Autosave + format-on-save (Settings → Editor) keep the file tidy for [[Publish a Site]].

## Personal knowledge base (notes that link)

**Goal:** grow a local network of ideas without a plugin marketplace.

1. Create a folder per life area or project under [[Libraries and Files]].
2. Write an index note (a mini MOC) that only contains `[[wikilinks]]` to children — this help vault’s [[MOC-English Docs]] is the pattern.
3. While writing, type `[[` and pick notes from autocomplete; use aliases when the sentence needs different wording: `[[Note|spoken label]]`.
4. Embed reusable definition cards with `![[…]]` instead of copy-paste — see [[Wikilinks and Embeds]].
5. Open [[Relationship Graph]] in **local** mode to see neighbors of the active note; switch to **vault** when you want the whole map.

**Useful habits**

- Unique note titles reduce ambiguous links.
- After renaming, keep link rewrite on **ask** until you trust the habit — then **always** for big reshuffles ([[Wikilinks and Embeds#Rename and rewrite]]).
- Put “hub” notes in Bookmarks so Quick Open is not the only door.

## Technical notes (code, diagrams, APIs)

**Goal:** keep code and diagrams readable while the prose stays Typora-smooth.

1. Fenced code blocks for snippets; language tags for highlighting — see [[Code and Syntax Highlighting]].
2. Architecture / sequence / state → Mermaid in a `mermaid` fence — cookbook in [[Math and Diagrams]].
3. Equations → `$…$` / `$$…$$` with KaTeX. Prefer source mode when editing long alignments.
4. Link related RFCs or design docs with wikilinks so Graph shows “this decision depends on…”.

**Useful habits**

- One diagram per idea; put the Mermaid source in the note so future-you can edit it.
- Paste as plain text (`Ctrl/⌘ + Shift + V`) when clipboard HTML wrecks indentation.

## Publish a handbook or course notes

**Goal:** the same vault becomes a static site.

1. Number folders (`00-`, `01-`, …) so nav order is obvious.
2. Keep a clear home note and unique titles.
3. Preview from Settings → Publish, then deploy `dist/` — full steps in [[Publish a Site]].
4. If you need Chinese + English, follow the `locales` + `translationKey` convention used by this vault.

**Checklist:**

![[Publish Checklist Card]]

## Reading notes and literature

**Goal:** capture quotes fast, connect them later.

1. One note per paper / book / article.
2. Blockquotes for citations; Callout `NOTE` for your commentary.
3. Wikilink people, concepts, and projects you already track.
4. Use vault Search (`Ctrl/⌘ + Shift + F`) when you remember a phrase but not the file name.

## Which path should I open first?

| If you care most about… | Start here |
| --- | --- |
| Writing feel | [[Editing Modes]] → [[Markdown Syntax]] |
| Linking ideas | [[Wikilinks and Embeds]] → [[Relationship Graph]] |
| Shipping a site | [[Publish a Site]] |
| Moving from another app | [[Migrate from Typora and Obsidian]] |

---

Next: [[Migrate from Typora and Obsidian]] · or [[Interface Tour]]
