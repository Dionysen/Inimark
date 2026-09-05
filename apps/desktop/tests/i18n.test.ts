import { describe, expect, test, beforeEach } from "vitest";

import {
  getLocale,
  initI18n,
  setLocale,
  t,
} from "../src/i18n/index.ts";

describe("i18n", () => {
  beforeEach(() => {
    try {
      localStorage.removeItem("inimark-locale");
    } catch {
      /* happy-dom stub */
    }
    initI18n("en");
  });

  test("translates English and Chinese keys", () => {
    expect(t("sidebar.tabs.files")).toBe("Files");
    setLocale("zh-CN");
    expect(getLocale()).toBe("zh-CN");
    expect(t("sidebar.tabs.files")).toBe("文件");
    expect(t("outline.tab")).toBe("大纲");
  });

  test("interpolates params and falls back to English", () => {
    setLocale("zh-CN");
    expect(t("dialogs.deleteMessage", { name: "notes.md" })).toContain("notes.md");
    expect(t("settings.nav.editor")).toBe("编辑器");
    // Unknown key falls back to key string
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});
