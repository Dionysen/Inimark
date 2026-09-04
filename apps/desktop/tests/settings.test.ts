import { describe, expect, test, beforeEach } from "vitest";

import { applySettings, loadSettings, saveSettings } from "../src/settings/store.ts";
import { mountSettingsView } from "../src/settings/view.ts";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--inimark-editor-font-size");
    document.documentElement.style.removeProperty("--inimark-editor-max-width");
  });

  test("persists and applies editor preferences", () => {
    saveSettings({ fontSize: 18, editorWidth: "wide", appearance: "dark" });
    const loaded = loadSettings();
    expect(loaded.fontSize).toBe(18);
    expect(loaded.editorWidth).toBe("wide");

    applySettings(loaded);
    expect(document.documentElement.style.getPropertyValue("--inimark-editor-font-size")).toBe(
      "18px",
    );
    expect(document.documentElement.style.getPropertyValue("--inimark-editor-max-width")).toBe(
      "60rem",
    );
  });
});

describe("settings view", () => {
  test("mounts standalone settings layout", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const view = mountSettingsView(host);
    expect(host.classList.contains("inimark-settings-window")).toBe(true);
    expect(host.querySelector(".inimark-settings-layout")).not.toBeNull();
    expect(host.querySelector(".inimark-settings-nav-item")).not.toBeNull();

    view.destroy();
    host.remove();
  });
});
