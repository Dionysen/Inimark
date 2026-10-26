import { afterEach, describe, expect, test, vi } from "vitest";

import { mountImageViewer } from "../src/image-viewer.ts";

describe("mountImageViewer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("shows and hides an image with zoom toolbar", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const viewer = mountImageViewer(host);

    expect(viewer.isVisible()).toBe(false);
    expect(host.querySelector(".inimark-image-viewer")).not.toBeNull();
    expect(host.querySelector(".inimark-image-viewer__caption")).toBeNull();
    expect(host.querySelectorAll(".inimark-image-viewer__toolbar .inimark-icon-btn")).toHaveLength(
      3,
    );

    viewer.show({ src: "https://example.com/a.png", name: "a.png" });
    expect(viewer.isVisible()).toBe(true);
    const img = host.querySelector<HTMLImageElement>(".inimark-image-viewer__img");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(img?.alt).toBe("a.png");

    viewer.hide();
    expect(viewer.isVisible()).toBe(false);
    expect(img?.getAttribute("src")).toBeNull();

    viewer.destroy();
    expect(host.querySelector(".inimark-image-viewer")).toBeNull();
  });

  test("wheel zooms the image and reset restores transform", () => {
    vi.stubGlobal(
      "getComputedStyle",
      () =>
        ({
          getPropertyValue: () => "",
        }) as CSSStyleDeclaration,
    );

    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
    });
    document.body.append(host);
    const viewer = mountImageViewer(host);
    viewer.show({ src: "https://example.com/a.png", name: "a.png" });

    const frame = host.querySelector<HTMLElement>(".inimark-image-viewer__frame")!;
    Object.defineProperty(frame, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
    });
    const img = host.querySelector<HTMLImageElement>(".inimark-image-viewer__img")!;

    frame.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, clientX: 200, clientY: 150, bubbles: true }),
    );
    expect(img.style.transform).toMatch(/scale\((?!1(?:\.0+)?\))/);

    const resetBtn = host.querySelectorAll<HTMLButtonElement>(
      ".inimark-image-viewer__toolbar .inimark-icon-btn",
    )[1]!;
    resetBtn.click();
    expect(img.style.transform).toBe("translate(0px, 0px) scale(1)");

    viewer.destroy();
    vi.unstubAllGlobals();
  });
});
