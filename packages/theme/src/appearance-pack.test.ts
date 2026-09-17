import { describe, expect, it, beforeEach } from "vitest";
import {
  configureTheme,
  resolveAppearanceMode,
  resolveActiveFromPair,
  parseThemePack,
  buildThemePack,
  THEME_PACK_FORMAT,
  THEME_PACK_VERSION,
  filterEditorSectionsByProfile,
  THEME_EDITOR_SECTIONS,
  CHROME_EDITOR_SECTIONS,
  DEFAULT_APP_THEME_PAIR,
} from "./index.ts";

describe("appearance resolve", () => {
  it("resolves system mode from system preference", () => {
    expect(resolveAppearanceMode("light")).toBe("light");
    expect(resolveAppearanceMode("dark")).toBe("dark");
    expect(resolveAppearanceMode("system", true)).toBe("dark");
    expect(resolveAppearanceMode("system", false)).toBe("light");
  });

  it("picks active id from theme pair", () => {
    const pair = { light: "light", dark: "ocean" };
    expect(resolveActiveFromPair(pair, "light")).toBe("light");
    expect(resolveActiveFromPair(pair, "dark")).toBe("ocean");
  });
});

describe("theme pack", () => {
  it("round-trips build and parse with empty code themes", () => {
    const pack = buildThemePack({
      name: "Test Pack",
      app: [
        {
          name: "My Theme",
          variables: {
            "--bg-primary": "#ffffff",
            "--accent": "#4eb289",
          },
        },
      ],
      code: [],
    });
    expect(pack.format).toBe(THEME_PACK_FORMAT);
    expect(pack.version).toBe(THEME_PACK_VERSION);
    expect(pack.themes.app).toHaveLength(1);
    expect(pack.themes.code).toHaveLength(0);

    const parsed = parseThemePack(JSON.stringify(pack));
    expect(parsed.name).toBe("Test Pack");
    expect(parsed.themes.app[0].variables["--bg-primary"]).toBe("#ffffff");
  });

  it("rejects wrong format", () => {
    expect(() =>
      parseThemePack(
        JSON.stringify({
          format: "other-pack",
          version: 2,
          name: "x",
          themes: { app: [], code: [] },
        }),
      ),
    ).toThrow(/theme pack/i);
  });
});

describe("editor schema profile", () => {
  beforeEach(() => {
    configureTheme({
      productId: "test",
      storageKeys: {
        appearanceMode: "test-appearance-mode",
        preferredAppTheme: "test-preferred-app-theme",
      },
      syncEvents: {
        appearance: "test:appearance",
        catalog: "test:catalog",
        themeCss: "test:css",
      },
      pack: {
        format: THEME_PACK_FORMAT,
        fileExtension: "json",
        dialogTitle: "Test",
      },
      features: { systemAppearance: true },
      editorProfile: "chrome",
      defaults: {
        appearanceMode: "system",
        preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
      },
      t: (key) => key,
    });
  });

  it("chrome profile keeps only chrome/body/scrollbar sections", () => {
    const filtered = filterEditorSectionsByProfile(THEME_EDITOR_SECTIONS, "chrome");
    expect(filtered.map((s) => s.id)).toEqual([...CHROME_EDITOR_SECTIONS]);
    expect(filtered.some((s) => s.id === "codeBlock")).toBe(false);
  });

  it("full profile keeps all sections", () => {
    const filtered = filterEditorSectionsByProfile(THEME_EDITOR_SECTIONS, "full");
    expect(filtered).toHaveLength(THEME_EDITOR_SECTIONS.length);
  });
});
