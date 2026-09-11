---
title: Wikilinks and Embeds
lang: en
translationKey: wikilinks
---

# Wikilinks and Embeds

**中文:** [[双链与嵌入|中文]] · [[Relationship Graph]] · [[Libraries and Files]]

Wikilinks are the core of Inimark’s “thinking” layer, with Obsidian-familiar syntax.

## Basic links

```markdown
[[Welcome]]
[[Welcome|custom label]]
[[Markdown Syntax#Tables]]
```

Live:

- Plain: [[Welcome]]
- Alias: [[MOC-English Docs|Open English MOC]]
- Heading: [[Markdown Syntax#Callouts]]
- Cross-language: [[欢迎|中文欢迎]]

> [!TIP]
> Typing `[[` opens autocomplete. Notes are indexed by **path without extension**, and also resolve by **basename** (shallower paths win on ties).

## Embeds

```markdown
![[Markdown Showcase Card]]
```

Rendered:

![[Markdown Showcase Card]]

Use embeds for reusable snippets, MOCs, and definition cards inside long notes.

> [!WARNING]
> Avoid **cyclic embeds** (A embeds B embeds A) — painful to read and publish.

## Outlinks and backlinks

| Term      | Meaning                   |
| --------- | ------------------------- |
| Outlinks  | Notes this note points to |
| Backlinks | Notes that point here     |

Lists appear in the [[Relationship Graph]] panel; the graph visualizes the same index.

## Index

The library keeps a link index (cached as `.inimark/link-index.json`):

```mermaid
flowchart LR
  MD[Markdown files] --> Parse[Parse [[…]]]
  Parse --> Idx[link-index]
  Idx --> AC[Autocomplete]
  Idx --> G[Graph]
  Idx --> Pub[Publish hrefs]
```

See [[Data Directory]].

## Rename and rewrite

On **rename / move**, Inimark can rewrite `[[links]]` elsewhere:

| Policy | When                |
| ------ | ------------------- |
| ask    | Safe default        |
| always | Large refactors     |
| never  | Full manual control |

Configured with library / link-update options; operations start from [[Libraries and Files]].

## Not (fully) there yet

Compared with Obsidian:

- [ ] Block refs `[[note#^id]]` as a full system
- [ ] First-class `#tags` / tag pane (theme tokens exist; parsing is weak)
- [ ] Hover preview as a fully documented product surface (editor has preview — trust the build)

See [[Roadmap]] and [[Feature Comparison]].

---

Prev: [[Libraries and Files]] · Next: [[Search Bookmarks Outline]]