import { describe, expect, test } from "vitest";

import { BUILTIN_THEMES, normalizeAppThemeId } from "../src/themes/builtin.ts";
import { getThemeSlotSelection } from "../src/settings/theme-panel.ts";
import { DEFAULT_APP_THEME_PAIR } from "../src/themes/appearance.ts";

describe("theme system", () => {
  test("includes the four builtin themes", () => {
    expect(BUILTIN_THEMES).toEqual(["light", "grey", "ocean", "dark-modern"]);
  });

  test("migrates removed dark and promoted custom ids", () => {
    expect(normalizeAppThemeId("dark", "ocean")).toBe("ocean");
    expect(normalizeAppThemeId("custom-er44d9pe", "ocean")).toBe("ocean");
    expect(normalizeAppThemeId("custom-vz8ojnvc", "ocean")).toBe("dark-modern");
    expect(normalizeAppThemeId("ocean", "light")).toBe("ocean");
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
