import { defineConfig } from "vite";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;
const uiRoot = resolve(__dirname, "../../packages/ui");
const i18nRoot = resolve(__dirname, "../../packages/i18n");
const shortcutKitRoot = resolve(__dirname, "../../packages/shortcut-kit");
const settingsKitRoot = resolve(__dirname, "../../packages/settings-kit");
const shellRoot = resolve(__dirname, "../../packages/shell");

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
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
    alias: [
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
    ],
  },
});
