---
title: Themes and Appearance
lang: en
translationKey: themes
---

# Themes and Appearance

**中文:** [[主题与外观|中文]] · [[Publish a Site]] · [[Interface Tour]]

## Appearance modes

| Mode | Meaning |
| --- | --- |
| Light | Light UI |
| Dark | Dark UI |
| System | Follow OS |

Built-ins include Light / Grey / Slate / Claude Code / Mint / Purple / Hermes / Ocean / Dark Modern / Cursor / Dracula; you can also import **custom theme packs** (`.inimark-theme.json`).

Related chrome options live under **Settings → Appearance**: UI font, menu density, auto-hide library bar, file-tree icons, and **left/right sidebar tab assignment**.

## What theme packs cover

- App + editor colors (CSS variables)
- Code highlighting themes (`--hljs-*` style variables)
- Frosted-glass style options (depending on theme/settings)
- Eyedropper-assisted customization for custom themes

> [!TIP]
> Export a theme you like and import it on another machine — appearance is a portable asset.

### Theme pack shape (for authors)

A `.inimark-theme.json` pack looks like:

```json
{
  "format": "inimark-theme-pack",
  "version": 2,
  "name": "My pack",
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "themes": {
    "app": [{ "name": "My App", "variables": { "--bg": "…" } }],
    "code": [{ "name": "My Code", "variables": { "--hljs-bg": "…" } }]
  }
}
```

Only custom themes participate in selective import/export. Prefer the in-app Theme UI over hand-writing packs unless you know the variables you need.

## Immersive chrome

With [[Interface Tour]]:

- Auto-hide title bar
- Auto-hide status bar
- Collapse sidebars on demand

Goal: **maximize the writing surface** — Typora-like focus with Obsidian-like sidebars. Pair with Focus (`F8`) and Typewriter (`F9`) from [[Editing Modes]].

## Fonts and zoom

- Editor / code fonts and sizes: **Settings → Editor**
- UI font: **Settings → Appearance**
- Quick zoom: `Ctrl/⌘ + mouse wheel` in the editor — [[Find Replace and Shortcuts]]

## Relation to Publish

Static sites can reuse the app theme system. In `publish.config.json` you typically set:

- `defaultTheme` — initial theme id
- `lightTheme` / `darkTheme` — optional pair for the site toggle

```json
{
  "siteName": "Inimark Docs",
  "defaultTheme": "light",
  "baseHref": "/",
  "out": "dist"
}
```

Full flow: [[Publish a Site]].

---

Next: [[Publish a Site]]
