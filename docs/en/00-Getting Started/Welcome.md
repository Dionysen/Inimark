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
| --- | --- |
| Edit | Typora-style **WYSIWYG** (no split live preview) |
| Know | Local **libraries** + `[[wikilinks]]` + [[Relationship Graph]] |
| Ship | Same notes → **static website** |

$$
\text{Inimark} \approx \underbrace{\text{WYSIWYG}}_{\text{Typora}} + \underbrace{\text{Vault + Graph}}_{\text{Obsidian}} + \underbrace{\text{SSG}}_{\text{Publish}}
$$

## Pick a path by who you are

| You are… | Read next |
| --- | --- |
| A long-form writer who wants focus | [[Everyday Workflows#Long-form writing (essays, reports, chapters)]] · [[Editing Modes]] |
| Building a personal knowledge network | [[Everyday Workflows#Personal knowledge base (notes that link)]] · [[Wikilinks and Embeds]] |
| Shipping notes as a site / handbook | [[Publish a Site]] · [[Everyday Workflows#Publish a handbook or course notes]] |
| Migrating from Typora or Obsidian | [[Migrate from Typora and Obsidian]] |

## Doc structure

| Pillar | Start here |
| --- | --- |
| Editing | [[Editing Modes]] · [[Markdown Syntax]] · [[Images and Attachments]] |
| Knowledge | [[Libraries and Files]] · [[Wikilinks and Embeds]] · [[Relationship Graph]] |
| Ship | [[Themes and Appearance]] · [[Publish a Site]] |

Full map: [[MOC-English Docs]].

## Where to go next

### Three-minute path

1. [[Install Inimark]] — install from [Releases](https://github.com/Dionysen/Inimark/releases)
2. [[Interface Tour]] — learn the chrome
3. [[Markdown Syntax]] — feel the editor
4. [[Wikilinks and Embeds]] — connect notes
5. [[Publish a Site]] — publish this help vault

> [!TIP]
> This `docs/` folder *is* a publishable help vault. **Open the folder as a library** in Inimark, read while editing, then Publish. Config lives in `publish.config.json`.

Scenario recipes (not just feature lists): [[Everyday Workflows]].

## Quick taste

This help vault **is** Markdown. Embedded showcase card:

![[Markdown Showcase Card]]

Wikilinks in three minutes:

![[Wikilink Three Minutes Card]]

## Design tenets (for the curious)

- **One writing surface** — no left/right preview split; markup appears when you need it.
- **Local-first** — vault on disk; metadata under `.inimark/` (see [[Data Directory]]).
- **Small and clear** — configurable sidebar tabs, no plugin marketplace yet (see [[Roadmap]]).

## Authoring conventions

- Prefer **unique note titles** so `[[wikilinks]]` resolve cleanly across languages.
- Pair translations with the same front matter `translationKey` (and `lang`) so the language switcher can jump between twins.
- Cross-link with aliases, e.g. `[[Welcome|English]]` / `[[欢迎|中文]]`.
- Keep Publish output under `dist/`; multilingual config is `locales` in `publish.config.json` — see [[Publish a Site]].
- Top-level `home` in the config and each locale’s `home` can differ; language switchers follow locale homes, while a bare build may use the top-level `home`.

$$
\text{Docs} = f(\text{notes}) \xrightarrow{\text{Publish}} \text{static site}
$$

Stuck? [[FAQ and Troubleshooting]].

---

Next: [[Install Inimark]] · or jump to [[Interface Tour]]
