---
title: Interface Tour
lang: en
translationKey: interface-tour
---

# Interface Tour

**中文:** [[界面导览|中文]] · [[MOC-English Docs]]

Think of the main window as three columns:

```text
┌──────────┬─────────────────────┬──────────┐
│ Left     │     Editor          │  Right   │
│ Files…   │  WYSIWYG / Source   │ Outline… │
└──────────┴─────────────────────┴──────────┘
               Status / Title bar
```

## Title bar

| Area | Role |
| --- | --- |
| Back / Forward | [[Libraries and Files#Navigation history|Navigation history]] across opened notes |
| Window controls | Min / max / close (macOS traffic lights) |
| More menu | Immersive chrome: auto-hide title bar / status bar, and related focus options |

> [!TIP]
> For distraction-free writing, auto-hide the title and status bars so the UI feels closer to “a single sheet of paper”. See [[Themes and Appearance]].

## Dual sidebars

Left and right **tabs are configurable** (Files / Search / Bookmarks / Outline / Graph).

| Tab | One-liner | Deep dive |
| --- | --- | --- |
| Files | Vault file tree | [[Libraries and Files]] |
| Search | Name + content search | [[Search Bookmarks Outline]] |
| Bookmarks | Bookmarks and groups | [[Search Bookmarks Outline]] |
| Outline | Heading tree for the active note | [[Search Bookmarks Outline]] |
| Graph | Graph plus outlinks / backlinks | [[Relationship Graph]] |

### How to arrange tabs

1. Open **Settings → Appearance**.
2. Assign each tab to the **left** or **right** sidebar list.
3. Resize by dragging the sidebar edge; collapse when you want a wider writing column.

Both sidebars can be collapsed — the editor keeps the full middle. Toggle visibility with the sidebar shortcut (default `Ctrl/⌘ + B`, rebindable).

## Editor host

The center is `@inimark/editor`:

- Default [[Editing Modes#WYSIWYG|WYSIWYG]]
- `Ctrl/⌘ + /` toggles [[Editing Modes#Source mode|source mode]]
- [[Editing Modes#Typewriter mode|Typewriter]] (`F9` / status bar) and [[Editing Modes#Focus mode|Focus]] (`F8`)

Context menus insert formatting, links, callouts — see [[Markdown Syntax]].

## Status bar

Typical items:

- Word / character counts
- Typewriter toggle
- Scroll to top / bottom
- Other edit state (depending on config)

## Settings window

Settings open in a **separate window** and are searchable. See [[Settings Overview]]:

Editor · Appearance · Theme · Shortcuts · Libraries · Publish · Images · Graph · About

---

Prev: [[Install Inimark]] · Next: [[Editing Modes]] · Scenarios: [[Everyday Workflows]]
