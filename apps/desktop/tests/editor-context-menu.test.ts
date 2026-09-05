import { describe, expect, test } from "vitest";

import { createEditor } from "@inimark/editor";
import { mountEditorContextMenu } from "../src/editor/context-menu.ts";

describe("editor context menu", () => {
  test("opens on right-click and runs bold command", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.append(host);

    const editor = createEditor(host, { initialContent: "hello" });
    const menu = mountEditorContextMenu(host, editor);

    host.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 2,
        clientX: 40,
        clientY: 40,
        bubbles: true,
        cancelable: true,
      }),
    );

    const panel = document.querySelector(".inimark-editor-context-menu") as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel!.hidden).toBe(false);

    const bold = panel!.querySelector(
      'button[aria-label="Bold"]',
    ) as HTMLButtonElement | null;
    expect(bold).not.toBeNull();
    const before = editor.getMarkdown();
    bold!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(editor.getMarkdown()).not.toBe(before);
    expect(panel!.hidden).toBe(true);

    menu.destroy();
    editor.destroy();
    host.remove();
  });
});
