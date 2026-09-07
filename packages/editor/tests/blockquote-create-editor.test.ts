import { describe, expect, test } from "vitest";

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
      expect(editor.view.state.doc.child(editor.view.state.doc.childCount - 2)?.type.name).toBe(
        "blockquote",
      );
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("welcome doc: click sentinel paragraph then > space wraps", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "# Welcome\n\nStart writing…" });

    try {
      const pm = host.querySelector(".ProseMirror")!;
      const sentinel = pm.lastElementChild as HTMLElement;
      const rect = sentinel.getBoundingClientRect();
      pm.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 20,
          clientY: rect.top + rect.height / 2,
          button: 0,
        }),
      );
      for (const e of [">", " "]) feedEvent(editor.view, e);
      const blockquote = editor.view.state.doc.child(
        editor.view.state.doc.childCount - 2,
      );
      expect(blockquote.type.name).toBe("blockquote");
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("welcome doc: click below content then > space wraps", () => {
    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    host.style.height = "480px";
    host.style.padding = "24px";
    document.body.appendChild(host);
    const editor = createEditor(host, { initialContent: "# Welcome\n\nStart writing…" });

    try {
      const rect = host.getBoundingClientRect();
      host.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 40,
          clientY: rect.bottom - 16,
          button: 0,
        }),
      );
      for (const e of [">", " "]) feedEvent(editor.view, e);
      const last = editor.view.state.doc.lastChild;
      expect(last?.type.name).toBe("paragraph");
      expect(editor.view.state.doc.childCount).toBeGreaterThanOrEqual(3);
      const blockquote = editor.view.state.doc.child(
        editor.view.state.doc.childCount - 2,
      );
      expect(blockquote.type.name).toBe("blockquote");
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
