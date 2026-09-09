import { describe, expect, test, beforeEach } from "vitest";

import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../src/settings/store.ts";
import { mountSettingsView } from "../src/settings/view.ts";

describe("settings store", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });
    document.documentElement.style.removeProperty("--inimark-editor-font-size");
    document.documentElement.style.removeProperty("--inimark-editor-max-width");
  });

  test("persists and applies editor preferences", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      fontSize: 18,
      editorWidth: 960,
      appearance: "dark",
      autoSave: true,
    });
    const loaded = loadSettings();
    expect(loaded.fontSize).toBe(18);
    expect(loaded.editorWidth).toBe(960);
    expect(loaded.autoSave).toBe(true);

    applySettings(loaded);
    expect(document.documentElement.style.getPropertyValue("--inimark-editor-font-size")).toBe(
      "18px",
    );
    expect(document.documentElement.style.getPropertyValue("--inimark-editor-max-width")).toBe(
      "960px",
    );
    expect(document.documentElement.dataset.glass).toBe("false");
  });

  test("glass effect defaults off and toggles data-glass", () => {
    expect(DEFAULT_SETTINGS.glassEffect).toBe(false);
    applySettings({ ...DEFAULT_SETTINGS, glassEffect: true });
    expect(document.documentElement.dataset.glass).toBe("true");
    applySettings({ ...DEFAULT_SETTINGS, glassEffect: false });
    expect(document.documentElement.dataset.glass).toBe("false");
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

    const search = host.querySelector<HTMLInputElement>(".inimark-search .inimark-field__input");
    expect(search).not.toBeNull();
    search!.value = "theme";
    search!.dispatchEvent(new Event("input", { bubbles: true }));

    const items = [...host.querySelectorAll<HTMLButtonElement>(".inimark-nav-item")];
    const visible = items.filter((item) => !item.hidden);
    expect(visible.length).toBe(1);
    expect(visible[0]?.dataset.section).toBe("theme");

    expect(host.querySelector(".inimark-settings-search-results")).not.toBeNull();

    const firstResult = host.querySelector<HTMLButtonElement>(
      ".inimark-settings-search-result",
    );
    expect(firstResult).not.toBeNull();
    firstResult!.click();

    expect(search!.value).toBe("");
    expect(host.querySelector(".inimark-settings-search-results")).toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('.inimark-nav-item[data-section="theme"]')
        ?.classList.contains("is-active"),
    ).toBe(true);

    view.destroy();
    host.remove();
  });

  test("refresh reflects font size changed elsewhere", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const view = mountSettingsView(host);
    saveSettings({ ...DEFAULT_SETTINGS, fontSize: 16, codeFontSize: 14 });

    const readFontSlider = () =>
      host.querySelector<HTMLInputElement>(
        '[data-setting-id="editor.fontSize"] .inimark-slider__input',
      );

    expect(readFontSlider()?.value).toBe("16");

    saveSettings({ ...DEFAULT_SETTINGS, fontSize: 22, codeFontSize: 20 });
    view.refresh();

    expect(readFontSlider()?.value).toBe("22");

    view.destroy();
    host.remove();
  });

  test("shows search shortcut hint and focuses search on Ctrl+F", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const view = mountSettingsView(host);
    const hint = host.querySelector(".inimark-settings-nav-hint");
    expect(hint).not.toBeNull();
    expect(hint?.querySelector("kbd")?.textContent).toContain("F");

    const search = host.querySelector<HTMLInputElement>(".inimark-search .inimark-field__input");
    search?.blur();

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(document.activeElement).toBe(search);

    view.destroy();
    host.remove();
  });
});
