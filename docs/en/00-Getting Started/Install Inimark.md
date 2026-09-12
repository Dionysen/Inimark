---
title: Install Inimark
lang: en
translationKey: install
---

# Install Inimark

**中文:** [[安装与启动|中文]] · Back to [[Welcome]] · [[MOC-English Docs]]

> [!NOTE]
> Inimark is a **Tauri 2** desktop app: Vite + TypeScript UI, editor core in `@inimark/editor`, native I/O in Rust.

## Install from GitHub Releases (recommended)

Download installers from the official release page:

[https://github.com/Dionysen/Inimark/releases](https://github.com/Dionysen/Inimark/releases)

Pick the asset for your platform:

| Platform | Recommended asset |
| --- | --- |
| macOS (Apple Silicon) | `.dmg` or `.app.tar.gz` |
| macOS (Intel) | `.dmg` or `.app.tar.gz` |
| Windows | `.msi` or `.exe` (NSIS) |
| Linux | `.AppImage` / `.deb` / `.rpm` |

After install, launch Inimark and open a local vault. In-app updates read `latest.json` from the same release.

> [!TIP]
> Prefer the **Latest** release. If the OS blocks an unsigned download, allow it in system privacy / security settings.

### First launch (what to do)

1. Open Inimark.
2. **Open folder** (or drop a folder) to create / select a library — this help vault is the repo’s `docs/` directory.
3. Optionally set **Settings → Appearance → Locale** (`en` / `zh-CN` / system).
4. Skim [[Interface Tour]], then write a throwaway note to feel WYSIWYG.

### When the OS blocks the app

| Platform | Typical fix |
| --- | --- |
| macOS | **Privacy & Security** → allow / Open Anyway; or right-click → Open once |
| Windows | SmartScreen → More info → Run anyway (only if you trust the GitHub asset) |
| Linux | Mark AppImage executable (`chmod +x`) if the desktop requires it |

More: [[FAQ and Troubleshooting]].

## Open this help vault

1. Launch Inimark
2. **Open folder** and select the repo’s `docs/` directory
3. Start from [[Welcome]] or [[MOC-English Docs]]
4. When ready, open Settings → **Publish** (see [[Publish a Site]])

### Checklist

- [ ] Installed from Releases and launches
- [ ] `docs/` added as a library
- [ ] (Optional) Publish preview opens

## Updates

Inimark can check GitHub Releases for updates (see **Settings → About**). Prefer staying on Latest unless you are debugging a specific build.

## Build from source (contributors)

For development builds you need a local toolchain:

| Dependency | Suggested |
| --- | --- |
| Node.js | 20+ |
| pnpm | 10+ |
| Rust | stable (needed for `pnpm tauri dev`) |

```bash
pnpm install

# Editor unit + spec tests
pnpm test:editor

# Desktop integration tests
pnpm test:desktop

# Editor in the browser
pnpm dev

# Tauri desktop
pnpm tauri dev
```

> [!WARNING]
> The first `pnpm tauri dev` compiles Rust crates and can take a while. Install [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

## Architecture sketch

- **`apps/desktop`** — shell, sidebars, settings, Publish UI
- **`packages/editor`** — ProseMirror WYSIWYG (the writing surface)
- **`site-render` + `inimark-ssg`** — build HTML, then preview or write `dist/`

The desktop shell drives the editor; Publish goes through site-render into the SSG.

See also [[Feature Comparison]] and [[Data Directory]].

---

Prev: [[Welcome]] · Next: [[Interface Tour]]
