import { describe, expect, test, vi } from "vitest";
import { TextSelection } from "prosemirror-state";

import { runFeatureCases } from "../utils.ts";
import { createEditor, type Editor } from "../../src/lib.ts";
import { showTableInsertPicker } from "../../src/features/table.ts";
import { tableSpecs } from "../../specs/features/table.specs.ts";

runFeatureCases(tableSpecs);

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

function setSelectionInTableCell(
  editor: Editor,
  options: { header?: boolean; row?: number; col?: number } = {},
): void {
  const { header = false, row = 0, col = 0 } = options;
  let seenRow = -1;
  let target: number | null = null;

  editor.view.state.doc.descendants((node, pos) => {
    if (node.type.name !== "table_row") return true;
    const firstCell = node.firstChild;
    if (!firstCell || firstCell.attrs.header !== header) return false;
    seenRow++;
    if (seenRow !== row) return false;
    const cell = node.child(col);
    if (!cell) return false;
    let cellPos = pos + 1;
    for (let i = 0; i < col; i++) cellPos += node.child(i).nodeSize;
    target = cellPos + 1;
    return false;
  });

  if (target == null) throw new Error("table cell not found");
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, target),
    ),
  );
}

function focusTable(editor: Editor): void {
  editor.focus();
  editor.view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  editor.view.dispatch(editor.view.state.tr.setMeta("table-test-refresh", true));
}

describe("table toolbar", () => {
  test("mounts lazily when the focused selection is inside a table", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      expect(document.body.querySelector(".table-toolbar")).toBeNull();

      setSelectionInTableCell(editor);
      focusTable(editor);

      expect(document.body.querySelector(".table-toolbar")).not.toBeNull();
      expect(document.body.querySelector(".table-resize-popup")).not.toBeNull();
      expect(document.body.querySelector(".table-rc-toolbar")).not.toBeNull();
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
    }
  });

  test("aligns the active column through the toolbar and serializes alignment", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor, { col: 1 });
      focusTable(editor);

      document.body
        .querySelector<HTMLElement>(".table-toolbar [data-align='right']")
        ?.click();

      expect(editor.getMarkdown()).toBe(
        "| A   | B   |\n| --- | --: |\n| a   | b   |",
      );
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
    }
  });

  test("toggles column alignment off when clicking the active align button again", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| :--- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      const alignLeft = document.body.querySelector<HTMLElement>(
        ".table-toolbar [data-align='left']",
      );
      alignLeft?.click();

      expect(editor.getMarkdown()).toBe("| A   | B   |\n| --- | --- |\n| a   | b   |");
      expect(alignLeft?.classList.contains("is-active")).toBe(false);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
    }
  });

  test("deletes the whole table through the row/column menu without leaving stale toolbar DOM", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body.querySelector<HTMLElement>(".table-rc-toolbar button")?.click();
      const items = document.body.querySelectorAll<HTMLElement>(
        ".table-rc-popup .inimark-editor-context-item",
      );
      items[items.length - 1]?.click();

      expect(editor.getMarkdown()).toBe("");
      expect(document.body.querySelector(".table-toolbar")).toBeNull();
      expect(document.body.querySelector(".table-resize-popup")).toBeNull();
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });

  test("resize popup dismisses when clicking outside the popup", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body.querySelector<HTMLElement>(".table-toolbar button[title='Resize']")?.click();
      const popup = document.body.querySelector<HTMLElement>(".table-resize-popup");
      expect(popup?.style.display).toBe("block");

      editor.view.dom.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );

      expect(popup?.style.display).toBe("none");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
    }
  });

  test("resize popup commits dimensions from numeric inputs and preserves column alignment", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| :--- | ---: |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body.querySelector<HTMLElement>(".table-toolbar button[title='Resize']")?.click();
      const popup = document.body.querySelector<HTMLElement>(".table-resize-popup");
      const inputs = popup?.querySelectorAll<HTMLInputElement>("input");
      expect(popup?.style.display).toBe("block");
      expect(inputs?.length).toBe(2);

      inputs![0]!.value = "3";
      inputs![1]!.value = "3";
      inputs![1]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(editor.getMarkdown()).toBe(
        "| A   | B   |     |\n| :-- | --: | --- |\n| a   | b   |     |\n|     |     |     |",
      );
      expect(document.body.querySelector<HTMLElement>(".table-resize-popup")?.style.display)
        .toBe("none");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });

  test("insert dialog creates a table with default 4 rows and 3 columns", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "" });

    try {
      showTableInsertPicker(editor.view);
      expect(document.body.querySelector(".table-insert-dialog")).not.toBeNull();

      document.body
        .querySelector<HTMLElement>(".table-insert-dialog__btn--primary")
        ?.click();

      expect(editor.getMarkdown()).toBe(
        "|     |     |     |\n| --- | --- | --- |\n|     |     |     |\n|     |     |     |\n|     |     |     |",
      );
      expect(document.body.querySelector(".table-insert-dialog")).toBeNull();
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-insert-dialog")?.remove();
    }
  });

  test("insert dialog creates a table with custom row and column counts", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "" });

    try {
      showTableInsertPicker(editor.view);
      const inputs = document.body.querySelectorAll<HTMLInputElement>(
        ".table-insert-dialog__input",
      );
      inputs[0]!.value = "2";
      inputs[1]!.value = "4";
      document.body
        .querySelector<HTMLElement>(".table-insert-dialog__btn--primary")
        ?.click();

      expect(editor.getMarkdown()).toBe(
        "|     |     |     |     |\n| --- | --- | --- | --- |\n|     |     |     |     |",
      );
      expect(document.body.querySelector(".table-insert-dialog")).toBeNull();
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-insert-dialog")?.remove();
    }
  });

  test("row/column popup stays inside the viewport when opened near the bottom edge", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      const trigger = document.body.querySelector<HTMLElement>(".table-rc-toolbar");
      const popup = document.body.querySelector<HTMLElement>(".table-rc-popup");
      expect(trigger).not.toBeNull();
      expect(popup).not.toBeNull();

      const triggerHeight = trigger!.offsetHeight || 32;
      Object.defineProperty(trigger!, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          new DOMRect(100, window.innerHeight - triggerHeight - 4, 32, triggerHeight),
      });

      trigger!.querySelector("button")?.click();
      expect(popup!.style.display).toBe("block");

      const popupRect = popup!.getBoundingClientRect();
      expect(popupRect.bottom).toBeLessThanOrEqual(window.innerHeight - 3);
      expect(popupRect.top).toBeLessThan(window.innerHeight - triggerHeight - 4);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });

  test("row/column menu shows shortcuts for bound commands", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body.querySelector<HTMLElement>(".table-rc-toolbar button")?.click();
      const shortcuts = Array.from(
        document.body.querySelectorAll<HTMLElement>(
          ".table-rc-popup .inimark-editor-context-item-shortcut",
        ),
      ).map((el) => el.textContent);

      expect(shortcuts.some((s) => /Enter|↩/.test(s ?? ""))).toBe(true);
      expect(shortcuts.some((s) => /↓/.test(s ?? ""))).toBe(true);
      expect(shortcuts.some((s) => /Backspace|⌫/.test(s ?? ""))).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });

  test("row/column menu copies the table markdown to the clipboard", async () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body.querySelector<HTMLElement>(".table-rc-toolbar button")?.click();
      const items = document.body.querySelectorAll<HTMLElement>(
        ".table-rc-popup .inimark-editor-context-item",
      );
      items[10]?.click();

      expect(writeText).toHaveBeenCalledWith(
        "| A   | B   |\n| --- | --- |\n| a   | b   |",
      );
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });

  test("row/column menu inserts a row below the current one", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "| A | B |\n| --- | --- |\n| a | b |",
    });

    try {
      setSelectionInTableCell(editor);
      focusTable(editor);

      document.body
        .querySelector<HTMLElement>(".table-rc-toolbar button")
        ?.click();
      const items = document.body.querySelectorAll<HTMLElement>(
        ".table-rc-popup .inimark-editor-context-item",
      );
      items[1]?.click();

      expect(editor.getMarkdown()).toBe(
        "| A   | B   |\n| --- | --- |\n| a   | b   |\n|     |     |",
      );
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".table-toolbar")?.remove();
      document.body.querySelector(".table-resize-popup")?.remove();
      document.body.querySelector(".table-rc-toolbar")?.remove();
      document.body.querySelector(".table-rc-popup")?.remove();
    }
  });
});
