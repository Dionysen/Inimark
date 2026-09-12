---
title: Wikilinks and Embeds
lang: en
translationKey: wikilinks
---

# Wikilinks and Embeds

**中文:** [[双链与嵌入|中文]] · [[Relationship Graph]] · [[Libraries and Files]]

Wikilinks are the core of Inimark’s “thinking” layer, with Obsidian-familiar syntax.

![[Wikilink Three Minutes Card]]

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
> Typing `[[` opens autocomplete (not inside `![[` image/note embeds). Notes are indexed by **path without extension**, and also resolve by **basename** (shallower paths win on ties).

### Autocomplete habits

| Input | Behavior |
| --- | --- |
| Empty `[[` | Recent notes (a few) + broader list |
| Typed query | Filtered candidates (capped) |
| ↑ ↓ / Enter / Tab | Navigate and accept |
| Enter with no match | Can create a new note |
| `|` or `#` | Stops the name query — add alias or heading after |

Unresolved links use a stronger / dashed underline treatment so you can spot missing targets. Fix the title, create the note, or remove the link.

## Embeds

### Note embeds

```markdown
![[Markdown Showcase Card]]
```

Rendered:

![[Markdown Showcase Card]]

Use embeds for reusable snippets, MOCs, and definition cards inside long notes.

### Image embeds

```markdown
![[photo.png]]
```

Common raster/vector types render as image embeds when the file resolves in the library. Prefer vault-relative assets — [[Images and Attachments]].

> [!WARNING]
> Avoid **cyclic embeds** (A embeds B embeds A) — painful to read and publish.

## Light PKM pattern

1. One **hub / MOC** note that mostly lists `[[children]]`.
2. Concept notes stay short; link outward instead of duplicating.
3. Embed a “definition card” where a long essay needs the same block.
4. Review neighbors in [[Relationship Graph]] local mode weekly.

This help vault’s [[MOC-English Docs]] is the living example.

## Outlinks and backlinks

| Term | Meaning |
| --- | --- |
| Outlinks | Notes this note points to |
| Backlinks | Notes that point here |

Lists appear in the [[Relationship Graph]] panel; unresolved outlinks are marked. The graph visualizes the same index.

## Index

The library keeps a link index (cached as `.inimark/link-index.json`):

1. Parse `[[…]]` from Markdown files
2. Build / refresh `link-index`
3. Feed autocomplete, Graph, and Publish href resolution

See [[Data Directory]].

## Rename and rewrite

On **rename / move**, Inimark can rewrite `[[links]]` elsewhere (including `#heading` and `|alias` suffixes):

| Policy | When |
| --- | --- |
| ask | Safe default |
| always | Large refactors |
| never | Full manual control |

Configured under Settings → Editor (link update on move); operations start from [[Libraries and Files]].

## Not (fully) there yet

Compared with Obsidian:

- [ ] Block refs `[[note#^id]]` as a full system
- [ ] First-class `#tags` / tag pane (theme tokens exist; parsing is weak)
- [ ] Hover preview as a fully documented product surface (editor has preview — trust the build)

See [[Roadmap]] and [[Feature Comparison]].

---

Prev: [[Libraries and Files]] · Next: [[Search Bookmarks Outline]]
