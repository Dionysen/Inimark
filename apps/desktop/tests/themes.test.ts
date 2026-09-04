import { describe, expect, test } from "vitest";

import { BUILTIN_THEMES } from "../src/themes/builtin.ts";
import { getThemeSlotSelection } from "../src/settings/theme-panel.ts";
import { DEFAULT_APP_THEME_PAIR } from "../src/themes/appearance.ts";

describe("theme system", () => {
  test("includes the three builtin themes", () => {
    expect(BUILTIN_THEMES).toEqual(["light", "grey", "dark"]);
  });

  test("getThemeSlotSelection detects light/dark/both", () => {
    expect(getThemeSlotSelection("light", DEFAULT_APP_THEME_PAIR)).toBe("light");
    expect(getThemeSlotSelection("dark", DEFAULT_APP_THEME_PAIR)).toBe("dark");
    expect(
      getThemeSlotSelection("light", { light: "light", dark: "light" }),
    ).toBe("both");
    expect(getThemeSlotSelection("grey", DEFAULT_APP_THEME_PAIR)).toBe("none");
  });
});
