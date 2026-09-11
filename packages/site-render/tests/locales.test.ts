import { describe, expect, it } from "vitest";
import {
  buildLocaleMap,
  filterManifestForLocale,
  inferLangFromPath,
  isUnderLocaleRoot,
} from "../src/locales.ts";
import type { ManifestNode, SiteLocalesConfig } from "../src/types.ts";

const locales: SiteLocalesConfig = {
  default: "zh",
  languages: [
    { id: "zh", label: "中文", root: "zh", home: "zh/欢迎.md" },
    { id: "en", label: "English", root: "en", home: "en/Welcome.md" },
  ],
};

const tree: ManifestNode[] = [
  { name: "README.md", path: "README.md", kind: "file", href: "notes/README.html" },
  {
    name: "zh",
    path: "zh",
    kind: "directory",
    children: [
      {
        name: "00-start",
        path: "zh/00-start",
        kind: "directory",
        children: [
          { name: "欢迎.md", path: "zh/00-start/欢迎.md", kind: "file", href: "notes/zh/00-start/欢迎.html" },
        ],
      },
    ],
  },
  {
    name: "en",
    path: "en",
    kind: "directory",
    children: [
      {
        name: "00-start",
        path: "en/00-start",
        kind: "directory",
        children: [
          { name: "Welcome.md", path: "en/00-start/Welcome.md", kind: "file", href: "notes/en/00-start/Welcome.html" },
        ],
      },
    ],
  },
];

describe("inferLangFromPath", () => {
  it("matches locale roots", () => {
    expect(inferLangFromPath("zh/欢迎.md", locales)).toBe("zh");
    expect(inferLangFromPath("en/Welcome.md", locales)).toBe("en");
    expect(inferLangFromPath("README.md", locales)).toBeUndefined();
  });
});

describe("isUnderLocaleRoot", () => {
  it("requires a locale root when locales are configured", () => {
    expect(isUnderLocaleRoot("zh/欢迎.md", locales)).toBe(true);
    expect(isUnderLocaleRoot("README.md", locales)).toBe(false);
    expect(isUnderLocaleRoot("README.md", undefined)).toBe(true);
  });
});

describe("filterManifestForLocale", () => {
  it("unwraps the active locale root into content folders", () => {
    const zh = filterManifestForLocale(tree, locales, "zh");
    expect(zh.map((n) => n.path)).toEqual(["zh/00-start"]);
    expect(zh[0]?.children?.[0]?.path).toBe("zh/00-start/欢迎.md");

    const en = filterManifestForLocale(tree, locales, "en");
    expect(en.map((n) => n.path)).toEqual(["en/00-start"]);
  });

  it("falls back to the default locale when page lang is missing", () => {
    const filtered = filterManifestForLocale(tree, locales, undefined);
    expect(filtered.map((n) => n.path)).toEqual(["zh/00-start"]);
  });
});

describe("buildLocaleMap", () => {
  it("pairs pages by translationKey", () => {
    const map = buildLocaleMap([
      { translationKey: "welcome", lang: "zh", htmlPath: "notes/zh/欢迎.html" },
      { translationKey: "welcome", lang: "en", htmlPath: "notes/en/Welcome.html" },
      { translationKey: "solo", lang: "zh", htmlPath: "notes/zh/solo.html" },
    ]);
    expect(map.welcome).toEqual({
      zh: "notes/zh/欢迎.html",
      en: "notes/en/Welcome.html",
    });
    expect(map.solo).toEqual({ zh: "notes/zh/solo.html" });
  });
});
