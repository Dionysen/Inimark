import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";
import { createEditor } from "../src/lib.ts";

describe("built-in editor themes", () => {
  test("editor controller does not expose runtime CSS theme import methods", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host);

    try {
      const api = editor as unknown as Record<string, unknown>;
      expect("importThemeFile" in api).toBe(false);
      expect("applyThemeCss" in api).toBe(false);
      expect("clearCustomTheme" in api).toBe(false);
      expect("getCustomThemeName" in api).toBe(false);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("dark Typora theme gives code blocks a distinct panel background", () => {
    const typoraThemeCss = readFileSync("src/styles/theme-typora.css", "utf8");

    expect(typoraThemeCss).toContain('[data-appearance="dark"]');
    expect(typoraThemeCss).toContain("pre");
  });
});
