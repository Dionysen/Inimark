---
title: Themes and Appearance
---

# Themes and Appearance

[toc]

**中文:** [[主题与外观|中文]] · [[Publish a Site]] · [[Interface Tour]]

## Appearance modes

| Mode | Meaning |
| --- | --- |
| Light | Light UI |
| Dark | Dark UI |
| System | Follow OS |

Built-ins include Light / Grey / Dark; you can also import **custom theme packs** (`.inimark-theme.json`).

## What theme packs cover

- App + editor colors
- Code highlighting themes
- Frosted-glass style options (depending on theme/settings)
- Eyedropper-assisted customization

> [!TIP]
> Export a theme you like and import it on another machine — appearance is a portable asset.

## Immersive chrome

With [[Interface Tour]]:

- Auto-hide title bar
- Auto-hide status bar
- Collapse sidebars on demand

Goal: **maximize the writing surface** — Typora-like focus with Obsidian-like sidebars.

## Relation to Publish

Static sites can reuse the app theme system (`defaultTheme` in `publish.config.json`).

Example fields for this vault:

```json
{
  "siteName": "Inimark Docs",
  "defaultTheme": "light",
  "baseHref": "/",
  "out": "dist",
  "home": "README.md"
}
```

Full flow: [[Publish a Site]].

## Fonts and zoom

Wheel-zoom the editor ([[Find Replace and Shortcuts]]); system font hooks come from the desktop shell.

---

Next: [[Publish a Site]]
