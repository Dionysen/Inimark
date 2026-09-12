<p align="center">
  <img src="docs/landing/icon.png" width="96" height="96" alt="Inimark icon" />
</p>

<h1 align="center">Inimark</h1>

<p align="center">
  <strong>Where Writing Never Ends</strong><br/>
  A quiet desk for serious writing — craft-first WYSIWYG, restrained design, room for thought to grow
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> ·
  <strong>English</strong>
</p>

<p align="center">
  <a href="https://dionysen.github.io/Inimark/"><img src="https://img.shields.io/badge/Website-Home-0a0a0a?style=flat-square" alt="Website" /></a>
  <a href="https://dionysen.github.io/Inimark/docs/en/00-Getting%20Started/Welcome.html"><img src="https://img.shields.io/badge/Docs-English-2563eb?style=flat-square" alt="Docs EN" /></a>
  <a href="https://dionysen.github.io/Inimark/docs/zh/00-%E7%94%B1%E6%AD%A4%E5%BC%80%E5%A7%8B/%E6%AC%A2%E8%BF%8E.html"><img src="https://img.shields.io/badge/Docs-中文-64748b?style=flat-square" alt="Docs ZH" /></a>
  <a href="https://github.com/Dionysen/Inimark/releases"><img src="https://img.shields.io/github/v/release/Dionysen/Inimark?style=flat-square&label=Release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="https://dionysen.github.io/Inimark/">Website</a> ·
  <a href="https://github.com/Dionysen/Inimark/releases">Download</a> ·
  <a href="https://dionysen.github.io/Inimark/docs/en/00-Getting%20Started/Welcome.html">Docs</a> ·
  <a href="#for-users">Users</a> ·
  <a href="#for-developers">Developers</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/note-dark.png" />
    <img src="docs/assets/note-light.png" alt="Inimark editor" width="900" />
  </picture>
</p>

---

## Why Inimark?

Most Markdown tools ask you to choose: a preview pane that splits the page, or a knowledge app that buries writing under chrome. Inimark starts from the opposite end —

**the editing surface is the product.**

- **Craft over chrome.** True WYSIWYG on a single canvas — no left–right split. Source mode is one keystroke away when you need it, then gone.
- **Design that stays quiet.** Ink-and-paper restraint: typography, spacing, and light/dark themes meant to disappear so the page can breathe.
- **Thought that can branch.** Local vaults, `[[wikilinks]]`, graphs, and outline — structure grows *from* writing, not as a separate dashboard.
- **Publish without leaving the desk.** The same notes become a static site when you’re ready to share.

> **Edit as art. Think as a network. Publish as a page.**

| Focus | What you feel |
| --- | --- |
| Writing | Immersive WYSIWYG; code, math, Mermaid, callouts, tables without breaking flow |
| Presence | Typewriter-friendly rhythm; chrome steps back; themes that feel like paper or night desk |
| Structure | WikiLinks, embeds, backlinks, global / local graphs |
| Navigation | Quick open, search, bookmarks, live outline |
| Share | Vault → static site for handbooks, courses, personal sites |

---

## Feature gallery

<table>
  <tr>
    <td width="50%" valign="top">
      <p><strong>A single surface for the sentence</strong></p>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/assets/note-dark.png" />
        <img src="docs/assets/note-light.png" alt="WYSIWYG writing" />
      </picture>
      <p>Where the pen lands, you see. Markup stays behind the curtain until you ask for source — then returns the page to silence.</p>
    </td>
    <td width="50%" valign="top">
      <p><strong>Structure as something you can see</strong></p>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/assets/graph-dark.png" />
        <img src="docs/assets/graph-light.png" alt="Relationship graph" />
      </picture>
      <p><code>[[wikilinks]]</code> grow while you write. The graph is not a report — it’s another way to look at the same thoughts.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <p><strong>Long form, still in hand</strong></p>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/assets/outline-dark.png" />
        <img src="docs/assets/outline-light.png" alt="Outline and navigation" />
      </picture>
      <p>Outline, search, and bookmarks stay close without crowding the prose — jump, then return to the line.</p>
    </td>
    <td width="50%" valign="top">
      <p><strong>Atmosphere you can tune</strong></p>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/assets/setting-dark.png" />
        <img src="docs/assets/setting-light.png" alt="Settings and appearance" />
      </picture>
      <p>Light and dark themes, editor preferences, publish — arranged so changing the room never interrupts the writing.</p>
    </td>
  </tr>
</table>

---

## For users

### Install

Download a build for your platform from [Releases](https://github.com/Dionysen/Inimark/releases):

| Platform | Recommended assets |
| --- | --- |
| macOS | `.dmg` or `.app.tar.gz` |
| Windows | `.msi` or `.exe` (NSIS) |
| Linux | `.AppImage` / `.deb` / `.rpm` |

> If the OS blocks an unsigned app: on macOS allow it under Privacy & Security; on Windows SmartScreen choose “Run anyway” (only if you trust the release).

### First run (three minutes)

1. Launch Inimark and **Open folder** as a vault (or drag a folder into the window).
2. Create a note and write on the canvas — what you type is what you see; no preview split.
3. Link notes with `[[Note name]]`; open the **relationship graph** when you want to see the shape of your thinking.
4. Keep **outline / search / bookmarks** at hand for long pieces without leaving the page.
5. When a draft is ready to share, use **Publish** in Settings (see [Publish a Site](https://dionysen.github.io/Inimark/docs/en/03-Appearance%20and%20Publish/Publish%20a%20Site.html)).

### Try the help vault in this repo

The `docs/` folder is a bilingual help vault you can open in Inimark:

1. Open the `docs/` folder in Inimark.
2. Start from **Welcome** or `MOC-English Docs`.
3. Edit as you read, then try Publish once.

Full docs:

- English: [Welcome to Inimark](https://dionysen.github.io/Inimark/docs/en/00-Getting%20Started/Welcome.html)
- 中文：[欢迎使用 Inimark](https://dionysen.github.io/Inimark/docs/zh/00-%E7%94%B1%E6%AD%A4%E5%BC%80%E5%A7%8B/%E6%AC%A2%E8%BF%8E.html)
- Product home: [dionysen.github.io/Inimark](https://dionysen.github.io/Inimark/)

---

## For developers

### Architecture

```
apps/desktop/          Tauri 2 shell + Vite/TS UI
packages/editor/       @inimark/editor — typora-web-style WYSIWYG (ProseMirror)
packages/site-render/  Vault → static site SSG model (Publish)
crates/inimark-ssg/    Native I/O for writing dist / local preview
docs/                  Help vault + marketing landing (docs/landing)
```

- **Editor core** (`@inimark/editor`): derived from [Albert-PZY/typora-web](https://github.com/Albert-PZY/typora-web) (MIT). See `NOTICE` and `packages/editor/UPSTREAM-LICENSE`.
- **Desktop app** (`@inimark/desktop`): Tauri 2 + Vite; Rust handles files, updates, publish writes, and other native I/O.
- **Docs site**: `pnpm docs:build` builds the help vault. With `docs/landing` present, the site root is the marketing homepage and docs live under `/docs/`.

### Prerequisites

| Dependency | Suggested |
| --- | --- |
| Node.js | 20+ |
| pnpm | 10+ (pinned via `packageManager`) |
| Rust | stable (needed for `pnpm tauri` / desktop builds) |

### Commands

```bash
pnpm install

# Desktop frontend (use tauri for the full native shell)
pnpm dev

# Tauri desktop debug
pnpm tauri dev

# Tests
pnpm test:editor
pnpm test:desktop
pnpm test

# Typecheck / build all
pnpm typecheck
pnpm build

# Docs site: write docs/dist; push existing dist to gh-pages
pnpm docs:build
pnpm docs:deploy
```

### Where to change what

- Editor behavior → `packages/editor` (unit tests and specs live there).
- Shell, libraries, publish UI → `apps/desktop`.
- Published HTML/CSS/paths → `packages/site-render`; marketing page sources in `docs/landing/`.
- Version bump: `pnpm bump-version`. Icon replace: `pnpm replace-icon`.

### Contributing

Issues and PRs are welcome. When user-visible behavior changes, update the matching pages under `docs/` and add tests where it makes sense.

---

## License

This repository is **MIT** licensed. The editor package includes typora-web-derived code; third-party notices are in [`NOTICE`](NOTICE).
