import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib.ts"),
      formats: ["es"],
      fileName: "inimark-editor",
    },
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        /^prosemirror-/,
        "markdown-it",
        /^markdown-it-/,
        "katex",
        "mermaid",
        /^@codemirror\//,
        "isomorphic-dompurify",
      ],
    },
  },
});
