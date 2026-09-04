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
  test("mounts split layout with nav topbar and searchable sections", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const view = mountSettingsView(host);
    expect(host.classList.contains("inimark-settings-shell")).toBe(true);
    expect(host.querySelector(".inimark-settings-layout")).not.toBeNull();
    expect(host.querySelector(".inimark-settings-nav-topbar")).not.toBeNull();
    expect(host.querySelector(".inimark-settings-main-wrap")).not.toBeNull();

    const search = host.querySelector<HTMLInputElement>(".inimark-settings-search-input");
    expect(search).not.toBeNull();
    search!.value = "theme";
    search!.dispatchEvent(new Event("input", { bubbles: true }));

    const items = [...host.querySelectorAll<HTMLButtonElement>(".inimark-settings-nav-item")];
    const visible = items.filter((item) => !item.hidden);
    expect(visible.length).toBe(1);
    expect(visible[0]?.dataset.section).toBe("appearance");

    view.destroy();
    host.remove();
  });
});
