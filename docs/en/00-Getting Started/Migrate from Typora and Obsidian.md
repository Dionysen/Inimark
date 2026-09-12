---
title: Migrate from Typora and Obsidian
lang: en
translationKey: migrate
---

# Migrate from Typora and Obsidian

**中文:** [[从Typora与Obsidian迁移|中文]] · [[Feature Comparison]] · [[Welcome]]

> Goal: land with the right expectations. Inimark is intentionally **not** a full clone of either app.

Read the honest matrix in [[Feature Comparison]], then use the checklist below.

## If you come from Typora

### What stays familiar

- One WYSIWYG surface — no forced split preview
- Source mode when you need raw Markdown
- Typewriter / focus comfort for long drafts
- Headings, lists, tables, math, Mermaid-style diagrams

### What you gain

- A **library** (folder vault) with file tree, Quick Open, search, bookmarks
- `[[wikilinks]]`, embeds, outlinks / backlinks, [[Relationship Graph]]
- Built-in [[Publish a Site|static Publish]] instead of only Pandoc export paths

### What you should not expect (yet)

- Typora’s full Pandoc export suite as the primary “ship” path
- Every Typora preference mirrored 1:1

### Migration steps

1. Install from [[Install Inimark|Releases]].
2. **Open folder** on the directory you already write in (or copy a subset into a new library).
3. Spend a day only in WYSIWYG — see [[Editing Modes]].
4. Start linking related notes with `[[` — see [[Wikilinks and Embeds]].
5. When a handbook is ready, try Publish once on a copy of the folder.

> [!TIP]
> Keep the first week’s link-rewrite policy on **ask** so renames never surprise you.

## If you come from Obsidian

### What stays familiar

- Local folder as the source of truth
- `[[note]]`, `[[note|alias]]`, `[[note#heading]]`, `![[embed]]`
- Graph + backlink-style lists
- Markdown files you can open in any editor

### What feels different

- Editing is **Typora-style WYSIWYG** by default, not “source + live preview”
- No plugin marketplace, Canvas, Daily Notes, or Dataview (see [[Roadmap]])
- File tree lists **Markdown notes**; image files resolve for embeds but are not first-class tree entries
- Publish is a **local SSG** you host yourself

### Migration steps

1. Point Inimark at an existing vault folder (or a duplicate for safety).
2. Confirm `.obsidian/` is ignored by Publish automatically — your notes remain the product.
3. Rebuild “plugin habits” with built-ins: Outline, Bookmarks, Graph, format-on-save.
4. Replace Dataview-style queries with curated MOC notes and Search for now.
5. Re-learn a few key chords — full list in [[Find Replace and Shortcuts]].

> [!WARNING]
> Community plugins and `.obsidian` configs do **not** run inside Inimark. Copy Markdown and assets; leave plugin state behind.

## Folder and link hygiene before switching

| Check                               | Why                               |
| ----------------------------------- | --------------------------------- |
| Unique note titles where possible   | Cleaner `[[wikilink]]` resolution |
| Prefer relative image paths         | Survives folder moves and Publish |
| Avoid depending on block refs `^id` | Not a full system yet             |
| Keep a backup / git commit          | Renames + rewrite are powerful    |

## Side-by-side habit map

| Habit in old app | In Inimark |
| --- | --- |
| Split preview | Stay in WYSIWYG; use source only when needed |
| Command palette plugins | Quick Open + Settings search + shortcuts |
| Graph view | Sidebar / floating [[Relationship Graph]] |
| Publish / export | Settings → Publish or `pnpm docs:build` |
| Themes | Theme packs (`.inimark-theme.json`) |

## After you migrate

- Walk [[Everyday Workflows]] for scenario recipes
- Skim [[FAQ and Troubleshooting]] when something feels “missing”
- Track honest gaps in [[Roadmap]]

---

Prev: [[Everyday Workflows]] · Next: [[Interface Tour]]
