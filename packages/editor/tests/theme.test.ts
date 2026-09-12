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

  test("Typora theme styles code blocks via theme CSS variables", () => {
    const typoraThemeCss = readFileSync("src/styles/theme-typora.css", "utf8");

    expect(typoraThemeCss).not.toContain('[data-appearance="dark"]');
    expect(typoraThemeCss).toContain(".ProseMirror pre");
    expect(typoraThemeCss).toContain("var(--bg-code");
  });

  test("first-line indent is display-only CSS gated by html data attribute", () => {
    const typoraThemeCss = readFileSync("src/styles/theme-typora.css", "utf8");
    expect(typoraThemeCss).toContain('html[data-first-line-indent="true"] .ProseMirror > p');
    expect(typoraThemeCss).toContain("text-indent: 2em");
  });
});
