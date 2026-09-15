import { afterEach, describe, expect, test } from "vitest";

import { createEditor } from "@inimark/editor";
import { mountFindBar } from "../src/editor/find-bar.ts";

describe("find bar shortcuts", () => {
  let host: HTMLElement;
  let pane: HTMLElement;
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    host?.remove();
    pane?.remove();
  });

  function setup() {
    pane = document.createElement("div");
    pane.className = "inimark-editor-pane";
    host = document.createElement("div");
    host.className = "inimark-editor-host";
    pane.append(host);
    document.body.append(pane);

    const editor = createEditor(host, { initialContent: "hello world" });
    const findBar = mountFindBar(pane, editor);
    editor.focus();

    cleanup = () => {
      findBar.destroy();
      editor.destroy();
    };

    return { editor, findBar };
  }

  function dispatchFindShortcut(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    // Target a node inside the markdown editor so isInMarkdownEditor passes.
    host.dispatchEvent(event);
    return event;
  }

  test("Ctrl+F opens the document find bar", () => {
    const { findBar } = setup();
    expect(findBar.isOpen()).toBe(false);

    const event = dispatchFindShortcut({ key: "f", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(findBar.isOpen()).toBe(true);
  });

  test("Ctrl+Shift+F does not open the document find bar", () => {
    const { findBar } = setup();

    const event = dispatchFindShortcut({
      key: "f",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(event.defaultPrevented).toBe(false);
    expect(findBar.isOpen()).toBe(false);
  });
});
