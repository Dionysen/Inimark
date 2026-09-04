/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;
const editorRoot = resolve(__dirname, "../../packages/editor");

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
  },
});
