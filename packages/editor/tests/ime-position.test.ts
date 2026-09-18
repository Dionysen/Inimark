import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  attachImePositionGuard,
  isImeComposing,
  reanchorImeHostGeometry,
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

    editable.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });

  test("reanchorImeHostGeometry blur/refocuses a focused text field", async () => {
    const input = document.createElement("input");
    input.value = "hello";
    document.body.append(input);
    input.focus();
    input.setSelectionRange(2, 4);

    const blur = vi.spyOn(input, "blur");
    const focus = vi.spyOn(input, "focus");

    reanchorImeHostGeometry(input);
    expect(blur).toHaveBeenCalledOnce();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    expect(focus).toHaveBeenCalledOnce();
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(4);

    input.remove();
  });

  test("reanchorImeHostGeometry refreshes instead of blur while composing", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    root.append(editable);
    editable.focus();

    editable.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    const blur = vi.spyOn(editable, "blur");
    expect(() => reanchorImeHostGeometry(editable)).not.toThrow();
    expect(blur).not.toHaveBeenCalled();

    editable.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });

  test("host geometry change reanchors when not composing", async () => {
    vi.useFakeTimers();
    const input = document.createElement("input");
    root.append(input);
    input.focus();

    let emitGeometry: (() => void) | null = null;
    destroy?.();
    destroy = attachImePositionGuard({
      root,
      hostGeometryDebounceMs: 50,
      subscribeHostGeometryChange: (onChange) => {
        emitGeometry = onChange;
        return () => {
          emitGeometry = null;
        };
      },
    });

    const blur = vi.spyOn(input, "blur");
    emitGeometry?.();
    expect(blur).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(blur).toHaveBeenCalledOnce();

    // Flush the focus rAF scheduled by reanchor.
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
  });

  test("host geometry change refreshes mid-composition without blur", async () => {
    vi.useFakeTimers();
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    root.append(editable);

    let emitGeometry: (() => void) | null = null;
    destroy?.();
    destroy = attachImePositionGuard({
      root,
      getActiveEditable: () => editable,
      hostGeometryDebounceMs: 50,
      subscribeHostGeometryChange: (onChange) => {
        emitGeometry = onChange;
        return () => {
          emitGeometry = null;
        };
      },
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
        data: "hao",
      }),
    );
    expect(updateCount).toBe(1);

    const blur = vi.spyOn(editable, "blur");
    emitGeometry?.();
    await vi.advanceTimersByTimeAsync(50);
    expect(blur).not.toHaveBeenCalled();
    expect(updateCount).toBe(2);

    editable.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    vi.useRealTimers();
  });
});
