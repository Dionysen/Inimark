import { describe, expect, test } from "vitest";

import {
  hasCopyableTextSelection,
  isBrowserShortcut,
  isSelectableTarget,
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

  test("allows unmodified typing and arrow keys in inputs", () => {
    const input = document.createElement("input");
    document.body.append(input);
    for (const key of ["a", "ArrowLeft", "ArrowRight", "Backspace"]) {
      const event = keyEvent({ key });
      Object.defineProperty(event, "target", { value: input });
      expect(shouldBlockNativeShortcut(event)).toBe(false);
    }
    input.remove();
  });

  test("blocks browser shortcuts in inputs", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const event = keyEvent({ key: "r", ctrlKey: true });
    Object.defineProperty(event, "target", { value: input });
    expect(shouldBlockNativeShortcut(event)).toBe(true);
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

  test("allows editor formatting chords that overlap browser shortcuts", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    const prose = document.createElement("div");
    prose.className = "ProseMirror";
    host.append(prose);
    document.body.append(host);

    for (const key of ["t", "-"]) {
      const event = keyEvent({ key, ctrlKey: true, altKey: true });
      Object.defineProperty(event, "target", { value: prose });
      expect(isBrowserShortcut(event)).toBe(true);
      expect(shouldBlockNativeShortcut(event)).toBe(false);
    }

    host.remove();
  });

  test("allows Ctrl+C when AI bubble text is selected", () => {
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    const text = document.createTextNode("hello from ai");
    bubble.append(text);
    document.body.append(bubble);

    const range = document.createRange();
    range.selectNodeContents(bubble);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    expect(hasCopyableTextSelection()).toBe(true);

    const chrome = document.createElement("button");
    document.body.append(chrome);
    const event = keyEvent({ key: "c", ctrlKey: true });
    Object.defineProperty(event, "target", { value: chrome });
    expect(shouldBlockNativeShortcut(event)).toBe(false);

    sel?.removeAllRanges();
    chrome.remove();
    bubble.remove();
  });

  test("allows Ctrl+C when focus is inside an AI bubble", () => {
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    bubble.tabIndex = 0;
    bubble.textContent = "reply";
    document.body.append(bubble);
    expect(isSelectableTarget(bubble)).toBe(true);

    const event = keyEvent({ key: "c", ctrlKey: true });
    Object.defineProperty(event, "target", { value: bubble });
    expect(shouldBlockNativeShortcut(event)).toBe(false);

    bubble.remove();
  });

  test("still blocks Ctrl+R on AI chrome", () => {
    const bubble = document.createElement("div");
    bubble.className = "inimark-ai-bubble";
    document.body.append(bubble);
    const event = keyEvent({ key: "r", ctrlKey: true });
    Object.defineProperty(event, "target", { value: bubble });
    expect(shouldBlockNativeShortcut(event)).toBe(true);
    bubble.remove();
  });
});
