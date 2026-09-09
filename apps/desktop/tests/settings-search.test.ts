import { beforeEach, describe, expect, test } from "vitest";

import { setLocale } from "../src/i18n/index.ts";
import { searchSettings, sectionHasSearchMatch } from "../src/settings/search-index.ts";

describe("settings search index", () => {
  beforeEach(() => {
    setLocale("zh-CN");
  });

  test("matches localized setting titles in Chinese", () => {
    const matches = searchSettings("字体");
    const ids = matches.map(({ item }) => item.id);
    expect(ids).toContain("editor.editorFont");
    expect(ids).toContain("editor.codeFont");
    expect(ids).toContain("appearance.uiFont");
  });

  test("matches shortcut key combos", () => {
    const matches = searchSettings("Ctrl+S");
    expect(matches.some(({ item }) => item.id === "shortcut.save")).toBe(true);
  });

  test("filters nav sections by contained settings", () => {
    expect(sectionHasSearchMatch("editor", "自动保存")).toBe(true);
    expect(sectionHasSearchMatch("graph", "自动保存")).toBe(false);
    expect(sectionHasSearchMatch("theme", "毛玻璃")).toBe(true);
  });

  test("supports multi-token queries", () => {
    const matches = searchSettings("代码 字号");
    expect(matches.some(({ item }) => item.id === "editor.codeFontSize")).toBe(true);
  });
});
