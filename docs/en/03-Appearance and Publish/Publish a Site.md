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

How the three entry points relate:

| Entry | What it does | Same site output? |
| --- | --- | --- |
| **Settings → Publish** | Build / preview any library (including `docs/`) | Yes — `publishLibrary` |
| **Settings → Dev → Publish Docs** | Build docs with that same pipeline (themes → `publish.config.json`) | Yes — same `publishLibrary` |
| **`pnpm docs:deploy`** | Force-push existing `docs/dist` to `gh-pages` | Uses whatever was built last (prefer Dev build) |
| **`pnpm docs:build`** | CLI-only rebuild of `docs/dist` | Same SSG; app custom themes only when built from Dev/Publish |

### In-app Publish (any library)

1. Open the vault (for this help site: `docs/`) as a library
2. Open **Settings → Publish**
3. Confirm site name, themes (app + code), `out`, `baseHref`, home
4. **Publish** to write `dist/`, then **Preview** locally
5. Upload `dist/` to any static host — or use the Dev + CLI flow for GitHub Pages

### Dev build + CLI deploy (GitHub Pages for this repo)

Development builds only (**About → Show Dev settings**):

1. Open **Settings → Dev → Publish Docs**
2. Pick light/dark app and code themes (saved to `docs/publish.config.json`)
3. **Build** (and optionally **Preview**)
4. In the repo root terminal: `pnpm docs:deploy` — pushes the existing `docs/dist` (no rebuild, so it keeps the Dev output)

Needs local GitHub auth for `git push`. To rebuild via CLI then push: `pnpm docs:deploy -- --rebuild`.

### CLI

```bash
# Build only → docs/dist (CLI pipeline)
pnpm docs:build

# Push existing docs/dist → origin/gh-pages (after Dev Build)
pnpm docs:deploy

# Optional: CLI rebuild + push
pnpm docs:deploy -- --rebuild
```

Site URL: https://dionysen.github.io/Inimark/
`publish.config.json` sets `baseHref` to `/Inimark/`.

> [!TIP]
> After the first deploy, set GitHub **Settings → Pages** → Source: **Deploy from a branch** → `gh-pages` / root.

### Other hosts

| Target | Idea |
| --- | --- |
| Netlify / Cloudflare Pages | Drag `dist/` or connect the repo + build command |
| Any nginx / object storage | Upload `dist/` as the web root (mind `baseHref`) |
| USB / offline folder | Open `index.html` only if `baseHref` is compatible |

For this repo on GitHub Pages, the **site root is the product marketing homepage** (`docs/landing`). Documentation lives under `/docs/` (e.g. [[欢迎]] / [[Welcome]]). The docs sidebar includes a **Home** link back to that page. Each language still uses its own welcome note as the docs entry.

## Authoring conventions

- Number folders for nav order (`00-`, `01-`, …)
- Keep **unique titles** for clean `[[wikilinks]]`
- Parallel trees: `zh/` and `en/`, pair with the same `translationKey`, and cross-link with aliases
- Lean on clear headings, callouts, and tables — see [[Markdown Syntax]]
- Docs entry points are the locale welcome notes (this vault: [[欢迎]] / [[Welcome]]); the site-root homepage is separate (see above)

## Extending Publish later

When you need search, SEO, or versioning, either:

1. **Grow Inimark Publish** (dogfood), or
2. Sync the same Markdown to a dedicated docs framework

Current strategy: **Publish first**, extend when needed.

Troubleshoot blanks and missing notes in [[FAQ and Troubleshooting]].

---

Related: [[Settings Overview]] · [[Data Directory]] · [[Feature Comparison]]
