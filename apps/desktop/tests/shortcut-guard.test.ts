import { describe, expect, test } from "vitest";

import {
  isBrowserShortcut,
  isTextEditingShortcut,
  shouldBlockNativeShortcut,
} from "../src/shortcuts/guard.ts";

function keyEvent(
  init: KeyboardEventInit & { key: string },
): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, ...init });
}

describe("shortcut guard", () => {
  test("blocks browser reload and devtools", () => {
    expect(isBrowserShortcut(keyEvent({ key: "F5" }))).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "F12" }))).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "r", ctrlKey: true }))).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "p", ctrlKey: true }))).toBe(true);
  });

  test("allows text editing chords in inputs", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const event = keyEvent({ key: "c", ctrlKey: true });
    Object.defineProperty(event, "target", { value: input });
    expect(isTextEditingShortcut(event)).toBe(true);
    expect(shouldBlockNativeShortcut(event)).toBe(false);
    input.remove();
  });

  test("blocks modified keys on app chrome", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const event = keyEvent({ key: "b", ctrlKey: true });
    Object.defineProperty(event, "target", { value: button });
    expect(shouldBlockNativeShortcut(event)).toBe(true);
    button.remove();
  });

  test("does not block unmodified typing keys", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const event = keyEvent({ key: "a" });
    Object.defineProperty(event, "target", { value: button });
    expect(shouldBlockNativeShortcut(event)).toBe(false);
    button.remove();
  });
});
