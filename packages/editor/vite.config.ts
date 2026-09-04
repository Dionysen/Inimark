import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
});
