import assert from "node:assert/strict";
import { describe, it } from "node:test";

const values = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});

const { DEFAULT_SETTINGS, normalizeSettings } = await import("./store.ts");

describe("settings", () => {
  it("defaults always-visible word count to off for existing settings", () => {
    const settings = normalizeSettings({ autoHideStatusbar: true });

    assert.equal(settings.autoHideStatusbar, true);
    assert.equal(settings.alwaysShowWordCount, false);
    assert.equal(settings.alwaysShowWordCount, DEFAULT_SETTINGS.alwaysShowWordCount);
  });

  it("preserves the always-visible word-count preference", () => {
    const settings = normalizeSettings({ alwaysShowWordCount: true });

    assert.equal(settings.alwaysShowWordCount, true);
  });
});
