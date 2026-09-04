import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { attachColumnResize } from "../src/ui/column-resize.ts";

describe("column-resize", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.style.position = "relative";
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    document.body.classList.remove("is-column-resizing");
  });

  test("attachColumnResize updates width while dragging and clamps", () => {
    let width = 240;
    const resize = attachColumnResize(host, {
      minWidth: 180,
      maxWidth: 480,
      getWidth: () => width,
      onWidthChange: (next) => {
        width = next;
      },
    });

    expect(host.querySelector(".inimark-resize-handle")).not.toBeNull();

    resize.el.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientX: 240, bubbles: true }),
    );
    expect(document.body.classList.contains("is-column-resizing")).toBe(true);
    expect(host.classList.contains("is-resizing")).toBe(true);

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 300, bubbles: true }),
    );
    expect(width).toBe(300);

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, bubbles: true }),
    );
    expect(width).toBe(180);

    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 900, bubbles: true }),
    );
    expect(width).toBe(480);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(document.body.classList.contains("is-column-resizing")).toBe(false);
    expect(host.classList.contains("is-resizing")).toBe(false);

    resize.destroy();
    expect(host.querySelector(".inimark-resize-handle")).toBeNull();
  });
});
