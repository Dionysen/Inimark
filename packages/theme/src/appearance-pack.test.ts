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
  buildThemeEditorSections,
  syncLinkedChromeBackgrounds,
  syncAccentDerived,
  accentHoverFromAccent,
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

const chromeConfig = {
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
  editorProfile: "chrome" as const,
  defaults: {
    appearanceMode: "system" as const,
    preferredAppTheme: { ...DEFAULT_APP_THEME_PAIR },
  },
  t: (key: string) => key,
};

describe("editor schema profile", () => {
  beforeEach(() => {
    configureTheme(chromeConfig);
  });

  it("chrome profile keeps body/chrome/controls/scrollbar sections", () => {
    const filtered = filterEditorSectionsByProfile(THEME_EDITOR_SECTIONS, "chrome");
    expect(filtered.map((s) => s.id)).toEqual([...CHROME_EDITOR_SECTIONS]);
    expect(filtered.some((s) => s.id === "codeBlock")).toBe(false);
  });

  it("full profile keeps all sections", () => {
    const filtered = filterEditorSectionsByProfile(THEME_EDITOR_SECTIONS, "full");
    expect(filtered).toHaveLength(THEME_EDITOR_SECTIONS.length);
  });

  it("chrome profile shows the simplified Vellum field set in order", () => {
    const sections = buildThemeEditorSections([]);
    expect(sections.map((s) => s.id)).toEqual([
      "body",
      "chrome",
      "controls",
      "scrollbar",
    ]);

    const body = sections.find((s) => s.id === "body")!.fields.map((f) => f.variable.name);
    expect(body).toEqual(["--text-primary", "--bg-primary"]);

    const chrome = sections.find((s) => s.id === "chrome")!.fields.map((f) => f.variable.name);
    expect(chrome).toEqual([
      "--bg-surface",
      "--bg-secondary",
      "--bg-tertiary",
      "--bg-input",
      "--library-volume-bg",
      "--border",
      "--border-width",
      "--accent",
      "--danger",
      "--sidebar-chrome-opacity",
    ]);

    const controls = sections
      .find((s) => s.id === "controls")!
      .fields.map((f) => f.variable.name);
    expect(controls).toEqual([
      "--radius-control",
      "--control-height",
      "--control-padding-x",
      "--control-font-size",
      "--menu-item-padding-y",
    ]);

    const all = sections.flatMap((s) => s.fields.map((f) => f.variable.name));
    expect(all).not.toContain("--accent-hover");
    expect(all).not.toContain("--bg-menu");
    expect(all).not.toContain("--tree-indent-hint-visible");
    expect(all).not.toContain("--library-book-btn-bg");
  });

  it("full profile keeps split fills and tree tokens", () => {
    configureTheme({ ...chromeConfig, editorProfile: "full" });
    const sections = buildThemeEditorSections([]);
    expect(sections.some((s) => s.id === "controls")).toBe(true);
    const names = sections.flatMap((s) => s.fields).map((f) => f.variable.name);
    expect(names).toContain("--bg-menu");
    expect(names).toContain("--accent-hover");
    expect(names).toContain("--tree-indent-hint-visible");
    expect(names).toContain("--radius-control");
  });
});

describe("syncLinkedChromeBackgrounds", () => {
  it("copies secondary into menu and chapter", () => {
    const synced = syncLinkedChromeBackgrounds([
      { name: "--bg-primary", value: "#1b1d24", type: "color" },
      { name: "--bg-secondary", value: "#808080", type: "color" },
      { name: "--bg-menu", value: "#111111", type: "color" },
      { name: "--library-chapter-bg", value: "#222222", type: "color" },
      { name: "--library-volume-bg", value: "#abcdef", type: "color" },
      { name: "--accent", value: "#74a7fe", type: "color" },
    ]);
    expect(synced.find((v) => v.name === "--bg-menu")?.value).toBe("#808080");
    expect(synced.find((v) => v.name === "--library-chapter-bg")?.value).toBe("#808080");
    expect(synced.find((v) => v.name === "--library-volume-bg")?.value).toBe("#abcdef");
    expect(synced.find((v) => v.name === "--accent")?.value).toBe("#74a7fe");
  });
});

describe("syncAccentDerived", () => {
  it("updates rgb and hover from accent", () => {
    const synced = syncAccentDerived([
      { name: "--accent", value: "#2563eb", type: "color" },
      { name: "--accent-rgb", value: "0, 0, 0", type: "color" },
      { name: "--accent-hover", value: "#000000", type: "color" },
    ]);
    expect(synced.find((v) => v.name === "--accent-rgb")?.value).toBe("37, 99, 235");
    expect(synced.find((v) => v.name === "--accent-hover")?.value).toBe(
      accentHoverFromAccent("#2563eb"),
    );
  });
});
