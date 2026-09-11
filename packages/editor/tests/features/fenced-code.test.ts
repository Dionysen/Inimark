import { describe, expect, test } from "vitest";
import { TextSelection } from "prosemirror-state";
import type { EditorView as CodeMirrorView } from "@codemirror/view";

import { runFeatureCases } from "../utils.ts";
import { createEditor } from "../../src/lib.ts";
import { mermaidRenderer } from "../../src/renderers/mermaid.ts";
import { feedEvent } from "../../specs/events.ts";
import { fencedCodeSpecs } from "../../specs/features/fenced-code.specs.ts";

runFeatureCases(fencedCodeSpecs);

type CodeMirrorElement = HTMLElement & {
  __typoraWebCodeMirrorView?: CodeMirrorView;
};

type FakeIntersectionObserverEntry = Pick<IntersectionObserverEntry, "isIntersecting">;

type FakeIntersectionObserverInstance = {
  trigger(entries: FakeIntersectionObserverEntry[]): void;
  observed: Element[];
  disconnects: number;
};

function createHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

function codeMirrorView(host: HTMLElement): CodeMirrorView {
  const cmElement = host.querySelector<CodeMirrorElement>(
    ".typora-web-code-editor .cm-editor",
  );
  const view = cmElement?.__typoraWebCodeMirrorView;
  if (!view) throw new Error("expected CodeMirror view");
  return view;
}

function nextTick(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("fenced code node view", () => {
  test("CodeMirror edits update the ProseMirror document and markdown", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```js\nold\n```" });

    try {
      const cm = codeMirrorView(host);
      cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: "next();" } });

      expect(editor.getMarkdown()).toBe("```js\nnext();\n```");
      expect(host.querySelector(".code-block-node")?.getAttribute("data-code"))
        .toBe("next();");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("language menu selection updates the code block language and stays in lang focus", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```\nplain\n```" });

    try {
      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      expect(input).not.toBeNull();

      input!.focus();
      input!.value = "Py";
      input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
      const menu = document.body.querySelector<HTMLElement>(".cb-lang-menu");
      const python = menu?.querySelector<HTMLElement>("[data-lang-name='Python']");
      expect(menu?.hidden).toBe(false);
      expect(python).not.toBeNull();

      python!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );

      expect(input!.value).toBe("Python");
      expect(editor.getMarkdown()).toBe("```Python\nplain\n```");
      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(true);
      expect(menu?.hidden).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("language input filters options and supports keyboard selection", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```\nplain\n```" });

    try {
      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      expect(input).not.toBeNull();

      input!.focus();
      input!.value = "py";
      input!.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const menu = document.body.querySelector<HTMLElement>(".cb-lang-menu");
      const options = [...menu!.querySelectorAll<HTMLElement>(".cb-lang-option")];
      expect(menu?.hidden).toBe(false);
      expect(options.length).toBeGreaterThan(1);
      expect(options.some((item) => item.dataset.langName === "Python")).toBe(true);
      expect(options[0]?.classList.contains("is-active")).toBe(true);

      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );
      expect(options[0]?.classList.contains("is-active")).toBe(false);
      expect(options[1]?.classList.contains("is-active")).toBe(true);

      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      expect(menu?.hidden).toBe(true);
      expect(input!.value).toBe(options[1]!.dataset.langName);
      expect(editor.getMarkdown()).toBe(`\`\`\`${options[1]!.dataset.langName}\nplain\n\`\`\``);

      input!.value = "ts";
      input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
      expect(menu?.hidden).toBe(false);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("language menu closes when the language input blurs", async () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```\nplain\n```" });

    try {
      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      expect(input).not.toBeNull();

      input!.focus();
      input!.value = "py";
      input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
      const menu = document.body.querySelector<HTMLElement>(".cb-lang-menu");
      expect(menu?.hidden).toBe(false);

      input!.blur();
      await nextTick(0);

      expect(menu?.hidden).toBe(true);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("ArrowUp from paragraph below focuses the language input", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```\n\nhello" });

    try {
      const doc = editor.view.state.doc;
      let helloStart: number | null = null;
      doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.textContent === "hello") {
          helloStart = pos + 1;
          return false;
        }
      });
      expect(helloStart).not.toBeNull();
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(doc, helloStart!)),
      );
      editor.view.focus();
      feedEvent(editor.view, "<ArrowUp>");

      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(true);
      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      expect(input).not.toBeNull();
      expect(document.body.querySelector<HTMLElement>(".cb-chrome")?.hidden).toBe(false);
      expect(document.activeElement).toBe(input);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("ArrowUp from language input returns to CodeMirror at the last line", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nline1\nline2\n```" });

    try {
      const cm = codeMirrorView(host);
      cm.focus();
      cm.dispatch({ selection: { anchor: cm.state.doc.length } });
      cm.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );

      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(true);

      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
      );

      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(false);
      expect(document.activeElement).toBe(cm.contentDOM);
      expect(cm.state.selection.main.head).toBe(cm.state.doc.length);
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("CodeMirror ArrowUp on the first line exits to the block above", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "above\n\n```ts\nbody\n```",
    });

    try {
      const cm = codeMirrorView(host);
      cm.dispatch({ selection: { anchor: 0 } });
      cm.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
      );

      expect(editor.view.state.selection.$from.parent.textContent).toBe("above");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("CodeMirror ArrowDown at end enters lang input then exits below", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });

    try {
      const cm = codeMirrorView(host);
      cm.focus();
      cm.dispatch({ selection: { anchor: cm.state.doc.length } });
      expect(cm.state.selection.main.head).toBe(cm.state.doc.length);
      cm.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );

      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(true);

      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      const menu = document.body.querySelector<HTMLElement>(".cb-lang-menu");
      const optionCount = menu?.querySelectorAll(".cb-lang-option").length ?? 0;
      for (let i = 0; i < optionCount - 1; i++) {
        input!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
        );
      }
      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );

      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(false);
      expect(document.body.querySelector<HTMLElement>(".cb-chrome")?.hidden).toBe(true);
      expect(editor.view.state.doc.childCount).toBe(2);
      expect(editor.view.state.selection.$from.parent.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("Alt-Mod-c in an empty CodeMirror block lifts to a paragraph", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

    try {
      const cm = codeMirrorView(host);
      cm.focus();
      cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: "" },
      });

      cm.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "c",
          altKey: true,
          metaKey: isMac,
          ctrlKey: !isMac,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(editor.view.state.doc.child(0).type.name).toBe("paragraph");
      expect(editor.view.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(editor.getMarkdown().replace(/\n+$/g, "")).toBe("");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("Backspace in an empty CodeMirror block lifts to a paragraph", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });

    try {
      const cm = codeMirrorView(host);
      cm.focus();
      cm.dispatch({
        changes: { from: 0, to: cm.state.doc.length, insert: "" },
      });

      cm.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );

      expect(editor.view.state.doc.child(0).type.name).toBe("paragraph");
      expect(editor.view.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(editor.getMarkdown().replace(/\n+$/g, "")).toBe("");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("CodeMirror ArrowRight at end exits below the code block", () => {
    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "lead\n\n```ts\nbody\n```\n\nafter",
    });

    try {
      const cm = codeMirrorView(host);
      cm.focus();
      cm.dispatch({ selection: { anchor: cm.state.doc.length } });
      cm.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );

      expect(editor.view.state.selection.$from.parent.textContent).toBe("after");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("ArrowDown from the language input appends a paragraph at document end", () => {
    const host = createHost();
    const editor = createEditor(host, { initialContent: "```ts\nbody\n```" });

    try {
      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      expect(input).not.toBeNull();

      input!.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );

      expect(editor.getMarkdown()).toBe("```ts\nbody\n```");
      expect(editor.view.state.doc.childCount).toBe(2);
      expect(editor.view.state.doc.child(1).type.name).toBe("paragraph");
      expect(editor.view.state.selection.$from.parent.type.name).toBe("paragraph");
    } finally {
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("typing in a Mermaid CodeMirror block keeps focus out of the language input", async () => {
    const originalRender = mermaidRenderer.render;
    (mermaidRenderer as unknown as {
      render: typeof originalRender;
    }).render = async () => ({ state: "success", svg: "<svg><text>ok</text></svg>" });

    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "```mermaid\ngraph TD\n  A --> B\n```\n\nbelow",
    });

    try {
      await nextTick(180);

      const doc = editor.view.state.doc;
      let belowStart: number | null = null;
      doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.textContent === "below") {
          belowStart = pos + 1;
          return false;
        }
      });
      expect(belowStart).not.toBeNull();
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(doc, belowStart!)),
      );
      feedEvent(editor.view, "<ArrowUp>");

      // Collapsed Mermaid: ArrowUp from below enters the source body (not lang),
      // so vertical navigation can edit the diagram instead of skipping it.
      const wrapper = host.querySelector<HTMLElement>(".code-block-node");
      expect(wrapper?.classList.contains("diagram-source-open")).toBe(true);
      expect(editor.view.state.selection.$from.parent.type.name).toBe("code_block");

      const cm = codeMirrorView(host);
      expect(document.activeElement).toBe(cm.contentDOM);

      cm.dispatch({ changes: { from: cm.state.doc.length, insert: "\n  C --> D" } });

      expect(document.activeElement).toBe(cm.contentDOM);
      expect(host.querySelector(".code-block-node")?.hasAttribute("data-lang-focus"))
        .toBe(false);
    } finally {
      (mermaidRenderer as unknown as {
        render: typeof originalRender;
      }).render = originalRender;
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("changing a Mermaid block to a normal language clears diagram state", async () => {
    const originalRender = mermaidRenderer.render;
    (mermaidRenderer as unknown as {
      render: typeof originalRender;
    }).render = async () => ({ state: "success", svg: "<svg><text>ok</text></svg>" });

    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "```mermaid\ngraph TD\n  A --> B\n```",
    });

    try {
      await nextTick(180);

      const wrapper = host.querySelector<HTMLElement>(".code-block-node");
      const panel = host.querySelector<HTMLElement>(".diagram-panel");
      expect(wrapper?.classList.contains("diagram-success")).toBe(true);
      expect(panel?.dataset.diagramState).toBe("success");

      const input = document.body.querySelector<HTMLInputElement>(".cb-lang-input");
      input!.value = "js";
      input!.dispatchEvent(new Event("input", { bubbles: true }));

      expect(wrapper?.classList.contains("has-diagram")).toBe(false);
      expect(wrapper?.classList.contains("diagram-success")).toBe(false);
      expect(panel?.dataset.diagramState).toBeUndefined();
      expect(panel?.textContent).toBe("");
      expect(editor.getMarkdown()).toBe("```js\ngraph TD\n  A --> B\n```");
    } finally {
      (mermaidRenderer as unknown as {
        render: typeof originalRender;
      }).render = originalRender;
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });

  test("defers Mermaid rendering until the diagram enters the viewport", async () => {
    const originalRender = mermaidRenderer.render;
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "userAgent",
    );
    const instances: FakeIntersectionObserverInstance[] = [];
    let renderCalls = 0;

    (mermaidRenderer as unknown as {
      render: typeof originalRender;
    }).render = async () => {
      renderCalls++;
      return { state: "success", svg: "<svg><text>ok</text></svg>" };
    };

    class FakeIntersectionObserver implements Partial<IntersectionObserver> {
      readonly root: Element | Document | null = null;
      readonly rootMargin: string;
      readonly thresholds: ReadonlyArray<number> = [0];
      observed: Element[] = [];
      disconnects = 0;
      private readonly callback: IntersectionObserverCallback;

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.callback = callback;
        this.rootMargin = options?.rootMargin ?? "0px";
        instances.push(this);
      }

      observe(target: Element): void {
        this.observed.push(target);
      }

      unobserve(target: Element): void {
        this.observed = this.observed.filter((entry) => entry !== target);
      }

      disconnect(): void {
        this.disconnects++;
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }

      trigger(entries: FakeIntersectionObserverEntry[]): void {
        this.callback(
          entries as IntersectionObserverEntry[],
          this as unknown as IntersectionObserver,
        );
      }
    }

    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    Object.defineProperty(Navigator.prototype, "userAgent", {
      configurable: true,
      get: () => "Mozilla/5.0",
    });

    const host = createHost();
    const editor = createEditor(host, {
      initialContent: "```mermaid\ngraph TD\n  A --> B\n```",
    });

    try {
      const wrapper = host.querySelector<HTMLElement>(".code-block-node");
      const panel = host.querySelector<HTMLElement>(".diagram-panel");

      const activeObserver = instances.find((instance) =>
        wrapper ? instance.observed.includes(wrapper) : false,
      );
      expect(activeObserver).not.toBeUndefined();
      expect(panel?.dataset.diagramState).toBe("loading");
      await nextTick(180);
      expect(renderCalls).toBe(0);
      expect(wrapper?.classList.contains("diagram-success")).toBe(false);

      activeObserver!.trigger([{ isIntersecting: true }]);
      await nextTick(180);

      expect(renderCalls).toBe(1);
      expect(activeObserver!.disconnects).toBe(1);
      expect(wrapper?.classList.contains("diagram-success")).toBe(true);
      expect(panel?.dataset.diagramState).toBe("success");
    } finally {
      (mermaidRenderer as unknown as {
        render: typeof originalRender;
      }).render = originalRender;
      globalThis.IntersectionObserver = originalIntersectionObserver;
      if (originalUserAgentDescriptor) {
        Object.defineProperty(
          Navigator.prototype,
          "userAgent",
          originalUserAgentDescriptor,
        );
      }
      editor.destroy();
      host.remove();
      document.body.querySelector(".cb-lang-menu")?.remove();
      document.body.querySelector(".cb-chrome")?.remove();
    }
  });
});
