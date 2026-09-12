import { describe, expect, test } from "vitest";

import { BUILTIN_THEMES, normalizeAppThemeId } from "../src/themes/builtin.ts";
import { getThemeSlotSelection } from "../src/settings/theme-panel.ts";
import {
  BUILTIN_THEME_IS_DARK,
  DEFAULT_APP_THEME_PAIR,
} from "../src/themes/appearance.ts";
import { getBuiltinColorMap } from "../src/themes/theme-tokens.ts";

describe("theme system", () => {
  test("includes the expanded builtin catalog", () => {
    expect(BUILTIN_THEMES).toEqual([
      "light",
      "grey",
      "slate",
      "claude-code",
      "mint",
      "purple",
      "hermes",
      "ocean",
      "dark-modern",
      "cursor",
      "dracula",
    ]);
  });

  test("every builtin has colors and a darkness flag", () => {
    for (const id of BUILTIN_THEMES) {
      expect(getBuiltinColorMap(id)).not.toBeNull();
      expect(typeof BUILTIN_THEME_IS_DARK[id]).toBe("boolean");
    }
    expect(BUILTIN_THEME_IS_DARK.mint).toBe(false);
    expect(BUILTIN_THEME_IS_DARK.dracula).toBe(true);
    expect(BUILTIN_THEME_IS_DARK.cursor).toBe(true);
  });

  test("migrates removed dark and promoted custom ids", () => {
    expect(normalizeAppThemeId("dark", "ocean")).toBe("ocean");
    expect(normalizeAppThemeId("custom-er44d9pe", "ocean")).toBe("ocean");
    expect(normalizeAppThemeId("custom-vz8ojnvc", "ocean")).toBe("dark-modern");
    expect(normalizeAppThemeId("ocean", "light")).toBe("ocean");
    expect(normalizeAppThemeId("slate", "light")).toBe("slate");
    expect(normalizeAppThemeId("claude-code", "light")).toBe("claude-code");
  });

  test("getThemeSlotSelection detects light/dark/both", () => {
    expect(getThemeSlotSelection("light", DEFAULT_APP_THEME_PAIR)).toBe("light");
    expect(getThemeSlotSelection("ocean", DEFAULT_APP_THEME_PAIR)).toBe("dark");
    expect(
      getThemeSlotSelection("light", { light: "light", dark: "light" }),
    ).toBe("both");
    expect(getThemeSlotSelection("grey", DEFAULT_APP_THEME_PAIR)).toBe("none");
  });
});
