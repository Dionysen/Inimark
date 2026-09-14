---
title: Search Bookmarks Outline
lang: en
translationKey: search-bookmarks
---

# Search, Bookmarks, and Outline

**中文:** [[搜索书签与大纲|中文]] · [[Interface Tour]] · [[Libraries and Files]]

Three navigation tabs that complement the [[Relationship Graph]] (plus Tags).

## Search

Open the Search tab or press `Ctrl/⌘ + Shift + F`.

| Capability | Notes |
| --- | --- |
| File names | Substring match |
| Content | Substring match inside notes |
| Case | Case-insensitive |
| Operators | **None** today — no `path:` / `tag:` filters |
| Jump | Opens the file; may reveal matches in the editor |

Results are batched for responsiveness (large files are capped). For regex inside one note, use [[Find Replace and Shortcuts|in-document find]] instead.

> [!NOTE]
> Search = **across files**; Find (`Ctrl/⌘ + F`) = **current file**.

## Bookmarks

Pin frequent notes and organize them in **groups**.

The model focuses on **files** (folder bookmarks were dropped).

### How to use

1. Open Bookmarks in a sidebar.
2. Add the active note (or pick from UI affordances in your build).
3. Create groups for “this week”, “publish queue”, “evergreen hubs”.
4. Click a bookmark to open — faster than hunting the tree.

Typical uses:

- This week’s “main thread”
- The help MOC [[MOC-English Docs]]
- Pre-publish review notes

- [ ] Bookmark [[Publish a Site]]
- [ ] Bookmark [[Markdown Syntax]]

## Tags

Open the **Tags** sidebar tab to browse every tag in the vault from:

- Inline `#tag` / `#parent/child`
- YAML front matter `tags:` / `tag:` (flow lists and `-` lists)

Sources are merged and de-duplicated; the pane still shows `#name`.

| Capability | Notes |
| --- | --- |
| Count | Note count on the right of each tag |
| Children | Expand to list notes that contain the tag; click to open |
| Sort | Name A–Z / Z–A, or count high→low / low→high |
| Expand / collapse | Toolbar toggles all tag groups |
| Search | Click the search icon to show a filter field (tag or note name) |

Inline syntax and chips: [[Markdown Syntax]]. Vault-wide `tag:` search operators are still not built.

## Outline

A tree of `AT` headings for the active note; click to jump.

Good for:

- Long-form structure while drafting
- Staying oriented without leaving the current view

Outline follows the active note — switch files and the tree refreshes. Pair with numbered headings for cleaner Publish pages.

Tab placement is configurable → [[Settings Overview]] · [[Interface Tour]].

---

Next: [[Relationship Graph]]
