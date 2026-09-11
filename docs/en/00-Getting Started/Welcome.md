---
title: Welcome
lang: en
translationKey: welcome
---

# Welcome to Inimark

**中文:** [[欢迎|中文]] · Map: [[MOC-English Docs]]

> **Typora-class editing** · **Obsidian-style thinking** · **One-click publish**

> [!IMPORTANT]
> Inimark is not “another Obsidian” or “another Typora”. The aim is:
>
> **Editing that aspires to beat Typora**, plus **Obsidian-like thinking and knowledge networks**, plus Inimark-native powers.

## In one line

| Axis | What Inimark does |
| ---- | ----------------- |
| Edit | Typora-style **WYSIWYG** (no split live preview) |
| Know | Local **libraries** + `[[wikilinks]]` + [[Relationship Graph]] |
| Ship | Same notes → **static website** |

$$
\text{Inimark} \approx \underbrace{\text{WYSIWYG}}_{\text{Typora}} + \underbrace{\text{Vault + Graph}}_{\text{Obsidian}} + \underbrace{\text{SSG}}_{\text{Publish}}
$$

## Doc structure

```mermaid
flowchart LR
  A[Getting started] --> B[Editing]
  B --> C[Vault & links]
  C --> D[Themes & publish]
  D --> E[Appendix]
```

| Pillar | Start here |
| --- | --- |
| Editing | [[Editing Modes]] · [[Markdown Syntax]] |
| Knowledge | [[Libraries and Files]] · [[Wikilinks and Embeds]] · [[Relationship Graph]] |
| Ship | [[Themes and Appearance]] · [[Publish a Site]] |

Full map: [[MOC-English Docs]].

## Where to go next

```mermaid
mindmap
  root((Inimark))
    Editing
      [[Editing Modes]]
      [[Markdown Syntax]]
      [[Math and Diagrams]]
    Knowledge
      [[Libraries and Files]]
      [[Wikilinks and Embeds]]
      [[Relationship Graph]]
    Shell
      [[Interface Tour]]
      [[Themes and Appearance]]
      [[Publish a Site]]
```

### Three-minute path

1. [[Install Inimark]] — get it running
2. [[Interface Tour]] — learn the chrome
3. [[Markdown Syntax]] — feel the editor
4. [[Wikilinks and Embeds]] — connect notes
5. [[Publish a Site]] — publish this help vault

> [!TIP]
> This `docs/` folder *is* a publishable help vault. **Open the folder as a library** in Inimark, read while editing, then Publish. Config lives in `publish.config.json`.

## Quick taste

This help vault **is** Markdown. Embedded showcase card:

![[Markdown Showcase Card]]

## Design tenets (for the curious)

- **One writing surface** — no left/right preview split; markup appears when you need it.
- **Local-first** — vault on disk; metadata under `.inimark/` (see [[Data Directory]]).
- **Small and clear** — configurable sidebar tabs, no plugin marketplace yet (see [[Roadmap]]).

## Authoring conventions

- Prefer **unique note titles** so `[[wikilinks]]` resolve cleanly across languages.
- Pair translations with the same front matter `translationKey` (and `lang`) so the language switcher can jump between twins.
- Cross-link with aliases, e.g. `[[Welcome|English]]` / `[[欢迎|中文]]`.
- Keep Publish output under `dist/`; multilingual config is `locales` in `publish.config.json` — see [[Publish a Site]].

$$
\text{Docs} = f(\text{notes}) \xrightarrow{\text{Publish}} \text{static site}
$$

---

Next: [[Install Inimark]] · or jump to [[Interface Tour]]
