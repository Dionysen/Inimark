import { describe, expect, test } from "vitest";

import { createEditor } from "@inimark/editor";
import { mountEditorContextMenu } from "../src/editor/context-menu.ts";
import { createMenu } from "../src/ui/widgets/menu.ts";
import {
  acquireExclusiveLayer,
  dismissExclusiveLayers,
  releaseExclusiveLayer,
} from "../src/ui/exclusive-layer.ts";

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

  test("callout submenu offers five kinds at the top level", () => {
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

    const panel = document.querySelector(".inimark-editor-context-menu") as HTMLElement;
    const calloutRow = [...panel.querySelectorAll(".inimark-editor-context-row")].find((row) =>
      row.textContent?.includes("Callout"),
    ) as HTMLElement;
    expect(calloutRow).toBeTruthy();

    calloutRow.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const flyout = document.querySelector(".inimark-editor-context-submenu") as HTMLElement;
    expect(flyout.hidden).toBe(false);
    expect(flyout.querySelectorAll(".inimark-editor-context-item")).toHaveLength(5);

    const tip = [...flyout.querySelectorAll(".inimark-editor-context-item")].find((btn) =>
      btn.textContent?.includes("Tip"),
    ) as HTMLButtonElement;
    tip.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(editor.getMarkdown()).toContain("[!TIP]");
    expect(panel.hidden).toBe(true);

    menu.destroy();
    editor.destroy();
    host.remove();
  });

  test("closes when another exclusive menu opens", () => {
    dismissExclusiveLayers();

    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.append(host);

    const editor = createEditor(host, { initialContent: "hello" });
    const editorMenu = mountEditorContextMenu(host, editor);
    const sidebarMenu = createMenu();
    document.body.append(sidebarMenu.el);

    host.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 2,
        clientX: 40,
        clientY: 40,
        bubbles: true,
        cancelable: true,
      }),
    );

    const panel = document.querySelector(".inimark-editor-context-menu") as HTMLElement;
    expect(panel.hidden).toBe(false);

    sidebarMenu.setOpen(true);
    expect(panel.hidden).toBe(true);
    expect(sidebarMenu.isOpen()).toBe(true);

    host.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 2,
        clientX: 60,
        clientY: 60,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(panel.hidden).toBe(false);
    expect(sidebarMenu.isOpen()).toBe(false);

    editorMenu.destroy();
    editor.destroy();
    sidebarMenu.destroy();
    host.remove();
    dismissExclusiveLayers();
  });

  test("closes on left-click in the editor surface outside the menu", () => {
    dismissExclusiveLayers();

    const host = document.createElement("div");
    host.className = "inimark-editor-host";
    document.body.append(host);

    const editor = createEditor(host, { initialContent: "hello" });
    const editorMenu = mountEditorContextMenu(host, editor);

    host.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 2,
        clientX: 40,
        clientY: 40,
        bubbles: true,
        cancelable: true,
      }),
    );

    const panel = document.querySelector(".inimark-editor-context-menu") as HTMLElement;
    expect(panel.hidden).toBe(false);

    host.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(panel.hidden).toBe(true);

    editorMenu.destroy();
    editor.destroy();
    host.remove();
    dismissExclusiveLayers();
  });
});

describe("exclusive layer", () => {
  test("closes on pointerdown outside the registered layer", () => {
    dismissExclusiveLayers();
    const layer = document.createElement("div");
    document.body.append(layer);
    let closed = false;
    acquireExclusiveLayer(layer, () => {
      closed = true;
    }, { contains: (node) => node != null && layer.contains(node) });

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(closed).toBe(true);
    layer.remove();
    dismissExclusiveLayers();
  });

  test("only one layer stays open", () => {
    dismissExclusiveLayers();
    const closed: string[] = [];
    const a = Symbol("a");
    const b = Symbol("b");

    acquireExclusiveLayer(a, () => closed.push("a"));
    acquireExclusiveLayer(b, () => closed.push("b"));
    expect(closed).toEqual(["a"]);

    releaseExclusiveLayer(b);
    acquireExclusiveLayer(a, () => closed.push("a2"));
    expect(closed).toEqual(["a"]);

    dismissExclusiveLayers();
    expect(closed).toEqual(["a", "a2"]);
  });
});
