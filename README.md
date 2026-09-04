# Inimark

Native Markdown editor built with **Tauri 2** (Rust) and a **typora-web**-based WYSIWYG core.

## Architecture

```
apps/desktop/          Tauri shell + minimal UI chrome
packages/editor/       @inimark/editor — typora-web fork (ProseMirror)
```

- **Editor core** (`@inimark/editor`): forked from [Albert-PZY/typora-web](https://github.com/Albert-PZY/typora-web) (MIT). See `NOTICE` and `packages/editor/UPSTREAM-LICENSE`.
- **Desktop app** (`@inimark/desktop`): Vite + TypeScript host; Rust backend reserved for native I/O extensions.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable (for Tauri)

## Commands

```bash
pnpm install

# Editor unit + spec tests
pnpm test:editor

# Desktop integration tests
pnpm test:desktop

# Web dev (editor in browser)
pnpm dev

# Tauri desktop dev
pnpm tauri dev
```

## License

This repository is MIT licensed. The editor package includes third-party code from typora-web — see `NOTICE`.
