import { describe, expect, test } from "vitest";

import {
  allocateUniqueThemeName,
  buildThemePack,
  parseThemePack,
} from "../src/themes/theme-pack.ts";

describe("theme pack", () => {
  test("parses v2 theme packs", () => {
    const pack = buildThemePack({
      name: "My Pack",
      app: [{ name: "One", variables: { "--bg-primary": "#fff" } }],
      code: [{ name: "Mono", variables: { "--hljs-keyword": "#f00" } }],
    });
    const parsed = parseThemePack(JSON.stringify(pack));
    expect(parsed.version).toBe(2);
    expect(parsed.themes.app).toHaveLength(1);
    expect(parsed.themes.code).toHaveLength(1);
    expect(parsed.themes.app[0]?.name).toBe("One");
  });

  test("rejects legacy v1 packs", () => {
    const legacy = {
      format: "inimark-theme-pack",
      version: 1,
      name: "Legacy",
      exportedAt: "2026-01-01T00:00:00.000Z",
      app: {
        light: { name: "Light", variables: {} },
        dark: { name: "Dark", variables: {} },
      },
      code: {
        light: { name: "Code Light", variables: {} },
        dark: { name: "Code Dark", variables: {} },
      },
    };
    expect(() => parseThemePack(JSON.stringify(legacy))).toThrow(/Unsupported theme pack version/);
  });

  test("allocates numbered names for duplicates", () => {
    const used = new Set(["Ocean", "Ocean 2"]);
    expect(allocateUniqueThemeName("Ocean", used)).toBe("Ocean 3");
    expect(allocateUniqueThemeName("Forest", used)).toBe("Forest");
    expect(allocateUniqueThemeName("Forest", used)).toBe("Forest 2");
  });

  test("allocates unique names when importing multiple themes with existing titles", () => {
    const used = new Set(["深色（副本）", "灰色（副本）", "浅色（副本）"]);
    expect(allocateUniqueThemeName("深色（副本）", used)).toBe("深色（副本） 2");
    expect(allocateUniqueThemeName("灰色（副本）", used)).toBe("灰色（副本） 2");
    expect(allocateUniqueThemeName("浅色（副本）", used)).toBe("浅色（副本） 2");
  });
});
