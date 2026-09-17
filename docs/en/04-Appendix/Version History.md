---
title: Version History
lang: en
translationKey: version-history
---

# Version History

**中文:** [[版本历史|中文]] · [[Install Inimark]] · [[MOC-English Docs]]

> [!NOTE]
> Each release below lists **what changed** and where to download it. GitHub Release pages always have the installers for that tag; in-app updates read `latest.json` from the **Latest** release.
>
> When you push a `vX.Y.Z` tag, CI reads the matching section’s **What’s new** block and uses it as the GitHub Release description. If that section is missing, the release keeps the default download template.

## How to download

1. Open the **Release page** link for the version you want (or browse [all releases](https://github.com/Dionysen/Inimark/releases)).
2. Under **Assets**, pick the file for your platform:

| Platform | Typical assets |
| --- | --- |
| macOS (Apple Silicon) | `.dmg` / `.app.tar.gz` (`aarch64`) |
| macOS (Intel) | `.dmg` / `.app.tar.gz` (`x64`) |
| Windows | `.msi` / `.exe` (NSIS) |
| Linux | `.AppImage` / `.deb` / `.rpm` |

Prefer **Latest** unless you are debugging an older build.

---

## 1.0.8 — 2026-09-16

**Release page:** (unreleased)

### What's new

- Support **`.txt` plain-text notes** in the file tree: edit with font / line height / paragraph spacing / first-line indent only — no Markdown parsing, source mode, wikilinks, tags, graph, or publish
- First-line indent is **per format**: Markdown off by default, plain text on by default (separate settings)
- Convert between Markdown and plain text from the file context menu or the titlebar More menu (renames the extension; content unchanged)
- New **AI document assistant** (sidebar): streaming chat with attachments; can read and edit notes when you ask (writes are undoable); history, new chat, and undo
- **Multiple providers**: DeepSeek / OpenAI / Anthropic / Gemini, plus custom OpenAI-compatible endpoints; API keys stored per provider; built-in models via dropdown
- **Configurable thinking intensity**: each model declares Off / Low / Medium / High levels mapped to native API parameters; deep replies can show a collapsible reasoning block
- After AI edits notes, a **review bar** above the composer lists files with +/- counts and diffs (Keep / Discard)—no longer mistaken for external disk changes
- Replies lightly render Markdown (task lists, quotes, code highlighting, math, Mermaid); links open in the browser; `[[wikilinks]]` jump to notes; fonts and theme match the editor
- Immersive composer: drag files/folders to attach, one-click copy of the final answer
- Intent-first: greetings get a short note summary and a ask-what-you-need—no vault browsing until you ask; replies prefer your message language
- Fix Windows startup window flash; fix Settings and other windows failing to open after AI was introduced

---

## 1.0.7 — 2026-09-15

**Release page:** [v1.0.7](https://github.com/Dionysen/Inimark/releases/tag/v1.0.7)

### What's new

- Drop the trailing sentinel paragraph after ordinary text so the live document matches saved markdown; a follow-on paragraph is still added after fences, tables, and other non-paragraph blocks
- Empty-gutter / side-margin drag-select still maps by pointer coordinates, but scrolls via edge auto-scroll instead of `scrollIntoView`
- Code-block / table toolbars stay hidden while drag-select sweeps across them; they appear only when the caret is idle inside the block
- Fix caret jumping into a wikilink when typing CJK punctuation (e.g. `。`) right after it — syntax chrome no longer collapses mid-IME composition
- Index newly created or copied notes immediately so wikilink autocomplete can find them

---

## 1.0.6 — 2026-09-14

**Release page:** [v1.0.6](https://github.com/Dionysen/Inimark/releases/tag/v1.0.6)

### What's new

- Tags: inline `#tag` / `#parent/child` chips and a Tags sidebar (including YAML front matter), with counts and open-note
- External file change detection: banner when the open file is modified or deleted on disk, with reload / save-as / overwrite
- Context-menu Quick Insert for the current local datetime
- Configurable code indent size; editor always keeps bottom scroll padding so the last line can reach mid-viewport
- Relationship graph: smooth hover highlighting, zoom-aware labels, layout preserved across soft refreshes
- Bookmarks and tags show parent folder paths; find bar no longer loses focus to the editor
- Tag styling and theme color polish

---

## 1.0.5 — 2026-09-12

**Release page:** [v1.0.5](https://github.com/Dionysen/Inimark/releases/tag/v1.0.5)

### What's new

- Marketing homepage for Publish: bilingual landing, screenshots, and site chrome
- Docs site layout: public root is the home page; help notes live under `/docs`
- README rewrite (EN + 中文) focused on editing craft and restrained design
- Version History in the help vault; tag releases can pull “What’s new” into GitHub Release notes

---

## 1.0.4 — 2026-09-12

**Release page:** [v1.0.4](https://github.com/Dionysen/Inimark/releases/tag/v1.0.4)

### What's new

- Focus mode, first-line indent, and richer theme / code-highlight options
- Wikilink preview triggers and clearer autocomplete behavior
- Mermaid and math block interactions improved for everyday writing
- Publish & docs: home-note selection, localization, and site polish
- Settings search, collapsible groups, and sidebar tree state that remembers you

---

## 1.0.3 — 2026-09-11

**Release page:** [v1.0.3](https://github.com/Dionysen/Inimark/releases/tag/v1.0.3)

### What's new

- Publish / SSG pipeline: generate a static site from your vault
- Local graph on published pages; multilingual docs structure
- Help vault content and site-render improvements

---

## 1.0.2 — 2026-09-10

**Release page:** [v1.0.2](https://github.com/Dionysen/Inimark/releases/tag/v1.0.2)

### What's new

- In-app auto-update: titlebar capsule, preflight, proxy, and error handling
- Source mode: Typora-style sparse line numbers
- Titlebar menus and IME caret positioning polish

---

## 1.0.1 — 2026-09-10

**Release page:** [v1.0.1](https://github.com/Dionysen/Inimark/releases/tag/v1.0.1)

### What's new

- Find & replace in the editor
- Clipboard / Markdown copy improvements
- Callout context menu, more-break, scrollbar and link-navigation fixes
- Library drop targets and management notifications

---

## 1.0.0 — 2026-09-06

**Release page:** [v1.0.0](https://github.com/Dionysen/Inimark/releases/tag/v1.0.0)

### What's new

- First public release of Inimark: craft-first WYSIWYG Markdown, local vaults, wikilinks, and desktop installers for macOS, Windows, and Linux

---

## Maintaining this page (contributors)

Before tagging a release:

1. Add a new `## X.Y.Z — YYYY-MM-DD` section at the **top** of the version list (below “How to download”).
2. Include a **Release page** link and a `### What's new` list — that list becomes the GitHub Release body.
3. Keep Chinese [[版本历史]] in sync.
4. Run `pnpm bump-version X.Y.Z`, commit, tag `vX.Y.Z`, and push.

Back to [[MOC-English Docs]] · [[Install Inimark]] · [[FAQ and Troubleshooting]]
