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
