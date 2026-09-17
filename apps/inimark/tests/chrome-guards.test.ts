import { describe, expect, test, vi } from "vitest";

import {
  installChromeGuards,
  isEditableChromeTarget,
} from "../src/platform/chrome-guards.ts";

describe("chrome guards", () => {
  test("detects editor and text inputs as editable", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    const inside = document.createElement("p");
    host.append(inside);

    const input = document.createElement("input");
    input.type = "text";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const label = document.createElement("span");
    label.textContent = "Sidebar label";

    expect(isEditableChromeTarget(inside)).toBe(true);
    expect(isEditableChromeTarget(input)).toBe(true);
    expect(isEditableChromeTarget(checkbox)).toBe(false);
    expect(isEditableChromeTarget(label)).toBe(false);
  });

  test("suppresses native context menu outside editable surfaces", () => {
    const teardown = installChromeGuards(document);
    const label = document.createElement("div");
    document.body.append(label);

    const selectEvent = new Event("selectstart", { cancelable: true, bubbles: true });
    label.dispatchEvent(selectEvent);
    expect(selectEvent.defaultPrevented).toBe(true);

    const menuEvent = new MouseEvent("contextmenu", {
      cancelable: true,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(menuEvent, "preventDefault");
    label.dispatchEvent(menuEvent);
    expect(preventSpy).toHaveBeenCalled();

    label.remove();
    teardown();
  });

  test("allows native context menu inside AI chat bubbles for copy", () => {
    const teardown = installChromeGuards(document);
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    const p = document.createElement("p");
    p.textContent = "hello";
    bubble.append(p);
    document.body.append(bubble);

    const menuEvent = new MouseEvent("contextmenu", {
      cancelable: true,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(menuEvent, "preventDefault");
    p.dispatchEvent(menuEvent);
    expect(preventSpy).not.toHaveBeenCalled();
    expect(menuEvent.defaultPrevented).toBe(false);

    bubble.remove();
    teardown();
  });

  test("allows selectstart inside editor host", () => {
    const teardown = installChromeGuards(document);
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    const p = document.createElement("p");
    host.append(p);
    document.body.append(host);

    const selectEvent = new Event("selectstart", { cancelable: true, bubbles: true });
    p.dispatchEvent(selectEvent);
    expect(selectEvent.defaultPrevented).toBe(false);

    host.remove();
    teardown();
  });

  test("allows selectstart inside AI chat bubbles", () => {
    const teardown = installChromeGuards(document);
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    const p = document.createElement("p");
    p.textContent = "hello";
    bubble.append(p);
    document.body.append(bubble);

    expect(isEditableChromeTarget(p)).toBe(true);
    const selectEvent = new Event("selectstart", { cancelable: true, bubbles: true });
    p.dispatchEvent(selectEvent);
    expect(selectEvent.defaultPrevented).toBe(false);

    bubble.remove();
    teardown();
  });
});
