import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { bindTooltip, initTooltipLayer, unbindTooltip } from "../src/ui/widgets/tooltip.ts";

describe("tooltip", () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
    teardown = initTooltipLayer();
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.useRealTimers();
    document.querySelectorAll(".inimark-tooltip").forEach((el) => el.remove());
  });

  test("bindTooltip stores text and removes native title", () => {
    const btn = document.createElement("button");
    btn.title = "Native";
    bindTooltip(btn, "Custom label", "Ctrl+N");
    expect(btn.getAttribute("title")).toBeNull();
    expect(btn.dataset.inimarkTooltip).toBe("Custom label");
    expect(btn.dataset.inimarkTooltipMeta).toBe("Ctrl+N");
  });

  test("shows styled tooltip after hover delay", () => {
    const btn = document.createElement("button");
    bindTooltip(btn, "New file");
    document.body.append(btn);

    btn.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(400);

    const tip = document.querySelector(".inimark-tooltip");
    expect(tip).not.toBeNull();
    expect(tip?.classList.contains("is-visible")).toBe(true);
    expect(tip?.classList.contains("inimark-glass")).toBe(true);
    expect(tip?.textContent).toContain("New file");
  });

  test("migrates legacy title attribute on hover", () => {
    const btn = document.createElement("button");
    btn.title = "From title";
    document.body.append(btn);

    btn.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(400);

    expect(btn.getAttribute("title")).toBeNull();
    expect(btn.dataset.inimarkTooltip).toBe("From title");
    expect(document.querySelector(".inimark-tooltip")?.textContent).toContain("From title");
  });

  test("unbindTooltip clears binding and hides active tooltip", () => {
    const btn = document.createElement("button");
    bindTooltip(btn, "Gone");
    document.body.append(btn);

    btn.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(document.querySelector(".inimark-tooltip.is-visible")).not.toBeNull();

    unbindTooltip(btn);
    expect(btn.dataset.inimarkTooltip).toBeUndefined();
    expect(document.querySelector(".inimark-tooltip.is-visible")).toBeNull();
  });
});
