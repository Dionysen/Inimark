---
title: Publish a Site
lang: en
translationKey: publish-site
---

# Publish a Site

**中文:** [[发布为网站|中文]] · [[Themes and Appearance]] · [[MOC-English Docs]]

Build the current library into a **static site**: same Markdown, same theme language, folder tree as navigation.

> [!IMPORTANT]
> This `docs/` help vault is meant for Publish. Config file: `publish.config.json`.

![[Publish Checklist Card]]

## What you get

| Capability | Status |
| --- | --- |
| Multi-page HTML | ✅ |
| Folder nav tree | ✅ |
| Per-page outline | ✅ |
| Local relationship graph (right rail) | ✅ |
| Theme switching | ✅ |
| Language switcher (`locales`) | ✅ |
| `[[wikilinks]]` → relative hrefs | ✅ |
| Local preview server | ✅ |
| Site-wide search | ❌ (extend later) |

Boundaries also live in [[Roadmap]].

## What is included / skipped

**Included:** Markdown notes under the vault (`.md` / `.markdown` / `.mdown`), plus assets those pages need.

**Skipped directories:** `.git`, `.obsidian`, `.inimark`, `node_modules`, and the Publish output folder (`out`, usually `dist`).

With `locales` configured, notes **outside** every language `root` are not published (no shared portal page unless it sits inside a root).

## Config fields

| Field | Meaning | This vault |
| --- | --- | --- |
| `siteName` | Site title | `Inimark Docs` |
| `siteDescription` | Meta description | see config |
| `defaultTheme` | Initial theme | see config |
| `lightTheme` / `darkTheme` | Site chrome theme pair | see config |
| `lightCodeTheme` / `darkCodeTheme` | Code block highlight theme pair | see config |
| `baseHref` | Deploy prefix | `/Inimark/` for GitHub Pages |
| `out` | Output dir | `dist` |
| `home` | Top-level home note | may differ from locale homes |
| `locales` | Optional multilingual | see below |

### `baseHref` pitfalls

| Hosting | Typical `baseHref` |
| --- | --- |
| Domain root / local folder open | `/` |
| GitHub project Pages `user.github.io/Repo/` | `/Repo/` |
| Subpath on any static host | `/your-subpath/` |

Wrong prefix → missing CSS, broken nav, missing images. If preview looks fine locally with `/` but production is blank/unstyled, fix `baseHref` first.

### Multilingual (optional)

Declare `locales` in `publish.config.json` to show a language switcher in the site chrome. The nav tree unwraps the active locale `root` (no `zh` / `en` shell folders).

```json
"locales": {
  "default": "zh",
  "languages": [
    { "id": "zh", "label": "中文", "root": "zh", "home": "zh/00-由此开始/欢迎.md" },
    { "id": "en", "label": "English", "root": "en", "home": "en/00-Getting Started/Welcome.md" }
  ]
}
```

Pair translations with front matter:

```yaml
---
title: Welcome
lang: en
translationKey: welcome
---
```

- `lang`: language id (optional; inferred when the path sits under a locale `root`)
- `translationKey`: shared key across languages; the switcher prefers the paired note, otherwise the locale `home`

> [!NOTE]
> The Publish **form** edits siteName / out / baseHref / home / app themes / code themes. `locales` and `siteDescription` live in the config file and are **preserved** when you save the form.

## Steps

### CLI (recommended for GitHub Pages)

```bash
# Build only → docs/dist
pnpm docs:build

# Build and force-push to origin/gh-pages
pnpm docs:deploy
```

Site URL: https://dionysen.github.io/Inimark/
`publish.config.json` sets `baseHref` to `/Inimark/`.

> [!TIP]
> After the first deploy, set GitHub **Settings → Pages** → Source: **Deploy from a branch** → `gh-pages` / root.

### In-app Publish

1. Open `docs/` as a library in Inimark
2. Open **Settings → Publish**
3. Confirm `siteName` / `out` / `baseHref` / `home`
4. **Preview** locally, or build
5. Deploy `dist/` to any static host

### Other hosts

| Target | Idea |
| --- | --- |
| Netlify / Cloudflare Pages | Drag `dist/` or connect the repo + build command |
| Any nginx / object storage | Upload `dist/` as the web root (mind `baseHref`) |
| USB / offline folder | Open `index.html` only if `baseHref` is compatible |

## Authoring conventions

- Number folders for nav order (`00-`, `01-`, …)
- Keep **unique titles** for clean `[[wikilinks]]`
- Parallel trees: `zh/` and `en/`, pair with the same `translationKey`, and cross-link with aliases
- Lean on clear headings, callouts, and tables — see [[Markdown Syntax]]
- Each language starts from its own welcome note (this vault: [[欢迎]] / [[Welcome]])

## Extending Publish later

When you need search, SEO, or versioning, either:

1. **Grow Inimark Publish** (dogfood), or
2. Sync the same Markdown to a dedicated docs framework

Current strategy: **Publish first**, extend when needed.

Troubleshoot blanks and missing notes in [[FAQ and Troubleshooting]].

---

Related: [[Settings Overview]] · [[Data Directory]] · [[Feature Comparison]]
