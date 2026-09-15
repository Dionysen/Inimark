import { describe, expect, test } from "vitest";

import { handleEditorSurfaceMouseDown } from "../src/click-focus.ts";
import { createEditor } from "../src/lib.ts";
import { feedEvent } from "../specs/events.ts";
import { pretty } from "../specs/pretty.ts";
import { apply, setup } from "./utils.ts";

describe("blockquote in live editor", () => {
  test("setup path: > then space wraps immediately", () => {
    const state = apply(setup(""), [">", " "]);
    expect(pretty(state)).toBe("<bq>|</bq>");
  });

  test("createEditor path: > then space wraps immediately", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "" });

    try {
      for (const e of [">", " "]) feedEvent(editor.view, e);
      expect(editor.view.state.doc.lastChild?.type.name).toBe("blockquote");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("welcome doc: click last paragraph focuses that paragraph", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "# Welcome\n\nStart writing…" });

    try {
      const pm = host.querySelector(".ProseMirror")!;
      const last = pm.lastElementChild as HTMLElement;
      const rect = last.getBoundingClientRect();
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 20,
        clientY: rect.top + Math.max(rect.height / 2, 2),
        button: 0,
      });
      Object.defineProperty(down, "target", { value: last });
      handleEditorSurfaceMouseDown(editor.view, down, host);
      expect(editor.view.state.selection.$from.parent.textContent).toContain("Start writing");
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
