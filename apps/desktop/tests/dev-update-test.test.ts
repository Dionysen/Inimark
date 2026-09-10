import { beforeEach, describe, expect, test } from "vitest";

import {
  DEFAULT_DEV_UPDATE_TEST_SETTINGS,
  DEV_UPDATE_TEST_STORAGE_KEY,
  getDevUpdateCheckOverride,
  loadDevUpdateTestSettings,
  mergeUpdateCheckOptions,
  saveDevUpdateTestSettings,
} from "../src/update/dev-update-test.ts";

describe("dev update test settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("loads defaults when storage is empty", () => {
    expect(loadDevUpdateTestSettings()).toEqual(DEFAULT_DEV_UPDATE_TEST_SETTINGS);
  });

  test("persists override version", () => {
    saveDevUpdateTestSettings({ overrideCurrentVersion: "0.1.0" });
    expect(loadDevUpdateTestSettings().overrideCurrentVersion).toBe("0.1.0");
    expect(localStorage.getItem(DEV_UPDATE_TEST_STORAGE_KEY)).toContain("0.1.0");
  });

  test("mergeUpdateCheckOptions adds override in dev builds", () => {
    saveDevUpdateTestSettings({ overrideCurrentVersion: "0.0.0" });
    expect(mergeUpdateCheckOptions({ useSystemProxy: false })).toEqual({
      useSystemProxy: false,
      devCurrentVersionOverride: "0.0.0",
    });
  });

  test("getDevUpdateCheckOverride ignores blank values", () => {
    saveDevUpdateTestSettings({ overrideCurrentVersion: "   " });
    expect(getDevUpdateCheckOverride()).toBeUndefined();
  });
});
