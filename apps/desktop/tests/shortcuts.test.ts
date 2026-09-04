import { describe, expect, test } from "vitest";

import { DEFAULT_SHORTCUTS } from "../src/shortcuts/defaults.ts";
import {
  formatShortcutDisplay,
  loadShortcuts,
  matchShortcut,
  saveShortcuts,
} from "../src/shortcuts/store.ts";

describe("shortcuts store", () => {
  test("matchShortcut matches Ctrl+S", () => {
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
    });
    expect(matchShortcut(event, ["Ctrl", "S"])).toBe(true);
  });

  test("formatShortcutDisplay renders key combo", () => {
    expect(formatShortcutDisplay(["Ctrl", "Shift", "S"])).toBe("Ctrl+Shift+S");
  });

  test("persists customized bindings", () => {
    localStorage.clear();
    const customized = DEFAULT_SHORTCUTS.map((item) =>
      item.id === "save" ? { ...item, keys: ["Ctrl", "Alt", "S"] } : item,
    );
    saveShortcuts(customized);
    const loaded = loadShortcuts();
    expect(loaded.find((item) => item.id === "save")?.keys).toEqual(["Ctrl", "Alt", "S"]);
  });
});
