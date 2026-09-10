import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const editorRoot = resolve(__dirname, "../editor");

export default defineConfig({
  resolve: {
    alias: [
      { find: "@inimark/editor", replacement: resolve(editorRoot, "src/lib.ts") },
    ],
  },
  test: {
    root: ".",
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
