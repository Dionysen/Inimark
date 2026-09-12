---
title: Markdown Syntax
lang: en
translationKey: markdown-syntax
---


# Markdown Syntax


**中文:** [[Markdown语法|中文]] · Related [[Editing Modes]] · [[Math and Diagrams]]

> [!IMPORTANT]
> This page is both a **reference** and a **living sample**. Open it in Inimark to see most formats rendered.

Embedded card:

![[Markdown Showcase Card]]

---

## Headings

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

Shortcuts: `Ctrl/⌘ + 1…6`, paragraph `Ctrl/⌘ + 0` (see [[Find Replace and Shortcuts]]).

## Inline styles

| Effect | Markup |
| --- | --- |
| **bold** | `**bold**` |
| *italic* | `*italic*` |
| ***both*** | `***both***` |
| ~~strike~~ | `~~strike~~` |
| ==highlight== | `==highlight==` |
| <u>underline</u> | `<u>underline</u>` |
| `code` | `` `code` `` |
| H~2~O | `H~2~O` |
| E=mc^2^ | `E=mc^2^` |

Escape marks with `\`, e.g. `\*\*not bold\*\*`.

## Links and images

- External: [example link](https://example.com/)
- Autolink: https://help.obsidian.md/
- Image: `![alt](path/or/url.png)` — durable paths and paste status: [[Images and Attachments]]
- Wikilinks: see [[Wikilinks and Embeds]] — e.g. [[Relationship Graph]]

Reference-style links are supported for advanced layouts.

## Lists

Unordered:

- Alpha
- Beta
  - Nested
  - Deeper

Ordered:

1. First
2. Second
3. Third

Tasks:

- [x] Learn WYSIWYG
- [x] Write a `[[wikilink]]`
- [ ] Publish the help site

### List keyboard habits

| Action | Default |
| --- | --- |
| Bullet list | `Alt + Ctrl/⌘ + U` |
| Ordered list | `Alt + Ctrl/⌘ + O` |
| Task list | `Alt + Ctrl/⌘ + X` |
| Indent / outdent | `Tab` / `Shift + Tab` (in lists) |
| Soft continue | `Enter` follows list “staircase” rules |

Leave a list by pressing Enter on an empty item (Typora-like).

## Quotes and Callouts

Plain quote:

> “The unexamined life is not worth living.” — a line knowledge-base essays love to cite.

### Callouts

> [!NOTE]
> Neutral context that should not break the main thread.

> [!TIP]
> Tip: `Ctrl/⌘ + K` inserts a Markdown link; for wikilinks just type `[[`.

> [!IMPORTANT]
> Critical: when renaming files, mind [[Wikilinks and Embeds#Rename and rewrite|link rewrite]].

> [!WARNING]
> Warning: image paste-to-disk is not a finished pipeline — see [[Images and Attachments]] and [[Roadmap]].

> [!DANGER]
> Danger: do not casually hand-edit `.inimark/link-index.json`.

Aliases: `WARN` / `CAUTION` map to warning.

Chooser card:

![[Callout Chooser Card]]

## Code fences

````markdown
```ts
export function hello(name: string): string {
  return `Hello, ${name}`;
}
```
````

Live example:

```ts
export function hello(name: string): string {
  return `Hello, ${name}`;
}
```

Language `mermaid` goes to diagram rendering → [[Math and Diagrams]].

More languages and highlighting details → [[Code and Syntax Highlighting]].

## Tables

| Module | Status | Docs |
| --- | --- | --- |
| Editor | ✅ | [[Editing Modes]] |
| Wikilinks | ✅ | [[Wikilinks and Embeds]] |
| Graph | ✅ | [[Relationship Graph]] |
| Tag pane | ❌ | [[Roadmap]] |

Insert a starter table with `Alt + Ctrl/⌘ + T`. Move rows/columns with `Alt + Ctrl/⌘ + Arrow` (or `Ctrl/⌘ + Ctrl + Arrow` variants depending on platform). For heavily broken tables after a paste, switch to [[Editing Modes#Source mode|source mode]], fix the pipes, then return.

## Horizontal rule

Content above.

---

Content below.

## Front matter

YAML at the top of this note:

```yaml
---
title: Markdown Syntax
lang: en
translationKey: markdown-syntax
---
```

Used for titles and similar metadata; Publish reads `title`, and for multilingual sites also `lang` / `translationKey` (see [[Publish a Site]]).

## TOC

Exact marker: put **`[toc]`** or **`[TOC]` alone on a line**, then press **Enter**. The editor turns it into a live table-of-contents atom (Typora-style). Before Enter, it is still plain text.

This help vault relies on the Outline sidebar instead, so these pages do not embed the marker.

## HTML and comments

- HTML blocks: allowed (use sparingly)
- Comments: `<!-- hides in reading flow -->`
- Excerpt break: a special HTML comment more-marker for publish/summary splits (not used in this help vault)

<!-- HTML comment sample -->

## Emoji

Shortcodes: `:smile:` `:rocket:` `:memo:` (set depends on the emoji feature)

Or Unicode directly: 📝 🚀 ✨

## Footnotes (partial)

A shortcut can insert `[^]`; **full footnote rendering is incomplete** — see [[Roadmap]].

## Cross-links

| Goal | Read |
| --- | --- |
| Code highlighting | [[Code and Syntax Highlighting]] |
| Math / diagrams | [[Math and Diagrams]] |
| Images | [[Images and Attachments]] |
| Keys | [[Find Replace and Shortcuts]] |
| Wikilinks | [[Wikilinks and Embeds]] |
| Themes | [[Themes and Appearance]] |

---

Prev: [[Editing Modes]] · Next: [[Code and Syntax Highlighting]]
