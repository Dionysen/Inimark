import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";

import { createEditor } from "../src/lib.ts";
import { feedEvent } from "../specs/events.ts";
import { renderMathToHtml } from "../src/renderers/math.ts";

describe("math renderer", () => {
  test("renders inline TeX with KaTeX markup", () => {
    const result = renderMathToHtml("E=mc^2", false);
    expect(result.ok).toBe(true);
    expect(result.html).toContain("katex");
    expect(result.html).toContain("math");
  });

  test("renders mhchem chemical expressions through KaTeX", () => {
    const result = renderMathToHtml("\\ce{H2O + CO2 -> H2CO3}", false);

    expect(result.ok).toBe(true);
    expect(result.html).toContain("katex");
    expect(result.html).not.toContain("math-error");
    expect(result.html).toContain("H");
    expect(result.html).toContain("O");
  });

  test("contains invalid TeX as an error result without throwing", () => {
    const result = renderMathToHtml("\\notacommand{", true);
    expect(result.ok).toBe(false);
    expect(result.html).toContain("math-error");
    expect(result.html).toContain("\\notacommand{");
  });

  test("block math hides source beside a successful preview until opened", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "before\n\n$$\nE=mc^2\n$$\n\nafter",
    });

    try {
      const block = host.querySelector<HTMLElement>("math-block");
      const source = host.querySelector<HTMLElement>("math-source");
      const preview = host.querySelector<HTMLElement>("math-preview");

      expect(block).not.toBeNull();
      expect(block?.classList.contains("math-success")).toBe(true);
      expect(block?.classList.contains("math-source-open")).toBe(false);
      expect(source?.textContent).toBe("E=mc^2");
      expect(preview?.querySelector(".katex")).not.toBeNull();

      preview?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      preview?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      expect(block?.classList.contains("math-source-open")).toBe(true);
      expect(editor.view.state.selection.$from.parent.type.name).toBe("math_block");

      // Clicking source keeps it open.
      source?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(block?.classList.contains("math-source-open")).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("leaving a math block hides the source again", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "before\n\n$$\nE=mc^2\n$$\n\nafter",
    });

    try {
      const block = host.querySelector<HTMLElement>("math-block");
      const source = host.querySelector<HTMLElement>("math-source");
      const preview = host.querySelector<HTMLElement>("math-preview");

      preview?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      expect(block?.classList.contains("math-source-open")).toBe(true);
      expect(source?.textContent).toBe("E=mc^2");

      const doc = editor.view.state.doc;
      let afterStart: number | null = null;
      doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.textContent === "after") {
          afterStart = pos + 1;
          return false;
        }
      });
      expect(afterStart).not.toBeNull();
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(doc, afterStart!)),
      );

      expect(block?.classList.contains("math-source-open")).toBe(false);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("ArrowDown/Up enter a collapsed math block instead of skipping it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "above\n\n$$\nE=mc^2\n$$\n\nafter",
    });

    try {
      const block = host.querySelector<HTMLElement>("math-block");
      expect(block?.classList.contains("math-source-open")).toBe(false);

      const doc = editor.view.state.doc;
      let aboveEnd: number | null = null;
      let afterStart: number | null = null;
      doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.textContent === "above") {
          aboveEnd = pos + 1 + node.content.size;
        }
        if (node.type.name === "paragraph" && node.textContent === "after") {
          afterStart = pos + 1;
        }
      });
      expect(aboveEnd).not.toBeNull();
      expect(afterStart).not.toBeNull();

      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(doc, aboveEnd!)),
      );
      editor.view.focus();
      feedEvent(editor.view, "<ArrowDown>");

      expect(editor.view.state.selection.$from.parent.type.name).toBe("math_block");
      expect(block?.classList.contains("math-source-open")).toBe(true);

      editor.view.dispatch(
        editor.view.state.tr.setSelection(
          TextSelection.create(editor.view.state.doc, afterStart!),
        ),
      );
      expect(block?.classList.contains("math-source-open")).toBe(false);

      feedEvent(editor.view, "<ArrowUp>");
      expect(editor.view.state.selection.$from.parent.type.name).toBe("math_block");
      expect(block?.classList.contains("math-source-open")).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
    }
  });

  test("invalid block math keeps source visible for editing", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, {
      initialContent: "before\n\n$$\n\\notacommand{\n$$\n\nafter",
    });

    try {
      const block = host.querySelector<HTMLElement>("math-block");
      const source = host.querySelector<HTMLElement>("math-source");
      expect(block?.classList.contains("math-error")).toBe(true);
      // Selection starts outside; error state still shows source via CSS
      // without needing math-source-open.
      expect(block?.classList.contains("math-source-open")).toBe(false);
      expect(source?.textContent).toContain("\\notacommand{");
    } finally {
      editor.destroy();
      host.remove();
    }
  });
});
