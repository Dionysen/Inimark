import { describe, expect, test } from "vitest";

import { BUILTIN_THEMES } from "../src/themes/builtin.ts";
import { getThemeSlotSelection } from "../src/settings/theme-panel.ts";
import { DEFAULT_APP_THEME_PAIR } from "../src/themes/appearance.ts";

describe("theme system", () => {
  test("includes all 10 builtin themes", () => {
    expect(BUILTIN_THEMES).toHaveLength(10);
    expect(BUILTIN_THEMES).toContain("mint");
    expect(BUILTIN_THEMES).toContain("ocean");
  });

  test("getThemeSlotSelection detects light/dark/both", () => {
    expect(getThemeSlotSelection("mint", DEFAULT_APP_THEME_PAIR)).toBe("light");
    expect(getThemeSlotSelection("mint-dark", DEFAULT_APP_THEME_PAIR)).toBe("dark");
    expect(
      getThemeSlotSelection("mint", { light: "mint", dark: "mint" }),
    ).toBe("both");
    expect(getThemeSlotSelection("white", DEFAULT_APP_THEME_PAIR)).toBe("none");
  });
});
