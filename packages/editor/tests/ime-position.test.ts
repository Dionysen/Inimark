import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  attachImePositionGuard,
  isImeComposing,
  refreshImeCaretPosition,
} from "../src/ime-position.ts";

describe("ime-position", () => {
  let root: HTMLDivElement;
  let destroy: (() => void) | null = null;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    destroy = attachImePositionGuard({ root });
  });

  afterEach(() => {
    destroy?.();
    destroy = null;
    root.remove();
  });

  test("tracks nested composition sessions", () => {
    expect(isImeComposing()).toBe(false);
    root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    expect(isImeComposing()).toBe(true);
    root.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    expect(isImeComposing()).toBe(true);
    root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(isImeComposing()).toBe(true);
    root.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(isImeComposing()).toBe(false);
  });

  test("refreshImeCaretPosition is safe without a DOM selection", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.append(editable);
    editable.focus();
    expect(() => refreshImeCaretPosition(editable)).not.toThrow();
    editable.remove();
  });

  test("scroll while composing schedules a caret refresh", async () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    root.append(editable);

    destroy?.();
    destroy = attachImePositionGuard({
      root,
      getActiveEditable: () => editable,
    });

    let updateCount = 0;
    editable.addEventListener("compositionupdate", () => {
      updateCount += 1;
    });

    editable.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    editable.dispatchEvent(
      new CompositionEvent("compositionupdate", {
        bubbles: true,
        data: "ni",
      }),
    );
    expect(updateCount).toBe(1);

    root.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    expect(updateCount).toBe(2);
  });
});
