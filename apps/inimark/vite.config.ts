/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const host = process.env.TAURI_DEV_HOST;
const editorRoot = resolve(__dirname, "../../packages/editor");
const siteRenderRoot = resolve(__dirname, "../../packages/site-render");
const uiRoot = resolve(__dirname, "../../packages/ui");
const i18nRoot = resolve(__dirname, "../../packages/i18n");
const shortcutKitRoot = resolve(__dirname, "../../packages/shortcut-kit");
const settingsKitRoot = resolve(__dirname, "../../packages/settings-kit");
const shellRoot = resolve(__dirname, "../../packages/shell");
const mermaidMinJs = require.resolve("mermaid/dist/mermaid.min.js");

const editorAliases = [
  {
    find: "@inimark/editor/widgets.css",
    replacement: resolve(editorRoot, "src/styles/widgets.css"),
  },
  {
    find: "@inimark/editor/theme-typora.css",
    replacement: resolve(editorRoot, "src/styles/theme-typora.css"),
  },
  {
    find: "@inimark/editor/theme-github.css",
    replacement: resolve(editorRoot, "src/styles/theme-github.css"),
  },
  { find: "@inimark/editor", replacement: resolve(editorRoot, "src/lib.ts") },
  { find: "@inimark/site-render", replacement: resolve(siteRenderRoot, "src/index.ts") },
  {
    find: "@dionysen/ui/tokens.css",
    replacement: resolve(uiRoot, "src/tokens.css"),
  },
  {
    find: "@dionysen/ui/widgets.css",
    replacement: resolve(uiRoot, "src/widgets/widgets.css"),
  },
  {
    find: "@dionysen/ui/tooltip.css",
    replacement: resolve(uiRoot, "src/widgets/tooltip.css"),
  },
  {
    find: "@dionysen/ui/confirm-dialog.css",
    replacement: resolve(uiRoot, "src/confirm-dialog.css"),
  },
  {
    find: "@dionysen/ui/status-toast.css",
    replacement: resolve(uiRoot, "src/status-toast.css"),
  },
  {
    find: "@dionysen/ui/font-catalog",
    replacement: resolve(uiRoot, "src/font-catalog.ts"),
  },
  { find: "@dionysen/ui", replacement: resolve(uiRoot, "src/index.ts") },
  { find: "@dionysen/i18n", replacement: resolve(i18nRoot, "src/index.ts") },
  {
    find: "@dionysen/shortcut-kit",
    replacement: resolve(shortcutKitRoot, "src/index.ts"),
  },
  {
    find: "@dionysen/settings-kit/editor-typography",
    replacement: resolve(settingsKitRoot, "src/editor-typography.ts"),
  },
  {
    find: "@dionysen/settings-kit",
    replacement: resolve(settingsKitRoot, "src/index.ts"),
  },
  {
    find: "@dionysen/shell",
    replacement: resolve(shellRoot, "src/index.ts"),
  },
  // Mermaid package exports omit the UMD build; alias so `?raw` can embed it.
  { find: "mermaid/dist/mermaid.min.js", replacement: mermaidMinJs },
];

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        settings: resolve(__dirname, "settings.html"),
      },
    },
  },
  resolve: {
    alias: editorAliases,
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
