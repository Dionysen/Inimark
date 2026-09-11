---
title: Inimark Docs
---

# Inimark Docs

> **Typora-class editing** · **Obsidian-style thinking** · **One-click publish**

Inimark is a native Markdown editor: write in a live WYSIWYG surface, grow a local vault with `[[wikilinks]]`, and ship a static site from the same notes.

<!--more-->

## Choose your language · 选择语言

| Language | Start here | Map of contents |
| --- | --- | --- |
| **中文** | [[欢迎]] | [[MOC-中文文档]] |
| **English** | [[Welcome]] | [[MOC-English Docs]] |

> [!TIP]
> Open this folder as a **library** in Inimark, then use **Settings → Publish** to preview or build the site. Config lives in `publish.config.json`.

---

## What you will find · 你将读到

```mermaid
flowchart LR
  A[Getting started<br/>由此开始] --> B[Editing<br/>编辑]
  B --> C[Vault & links<br/>库与双链]
  C --> D[Themes & publish<br/>主题与发布]
  D --> E[Appendix<br/>附录]
```

| Pillar | 中文入口 | English entry |
| --- | --- | --- |
| Editing | [[编辑模式]] · [[Markdown语法]] | [[Editing Modes]] · [[Markdown Syntax]] |
| Knowledge | [[库与文件]] · [[双链与嵌入]] · [[关系图谱]] | [[Libraries and Files]] · [[Wikilinks and Embeds]] · [[Relationship Graph]] |
| Ship | [[主题与外观]] · [[发布为网站]] | [[Themes and Appearance]] · [[Publish a Site]] |

---

## Quick taste · 语法速览

This help vault **is** Markdown. The next block is embedded from a shared card:

![[语法速览卡片]]

English twin:

![[Markdown Showcase Card]]

---

## Contribute to this vault · 维护说明

- Prefer **unique note titles** so `[[wikilinks]]` resolve unambiguously across `zh/` and `en/`.
- Cross-link languages with aliases, e.g. `[[Welcome|English]]` / `[[欢迎|中文]]`.
- Keep Publish output under `dist/` (gitignored globally via `dist/`).

$$
\text{Docs} = f(\text{notes}) \xrightarrow{\text{Publish}} \text{static site}
$$
