import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { initI18n } from "../i18n/index.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "../settings/store.ts";
import { mountPlaintextEditor } from "./plaintext.ts";
import { formatPlaintext } from "./plaintext-format.ts";
import { countText, mountStatusBar } from "./status-bar.ts";

const happy = new Window({ url: "https://localhost/" });
const doc = happy.document;

Object.assign(globalThis, {
  document: doc,
  window: happy,
  HTMLElement: happy.HTMLElement,
  Element: happy.Element,
  Node: happy.Node,
  localStorage: happy.localStorage,
  getSelection: () => happy.getSelection(),
  requestAnimationFrame: (cb: (time: number) => void) =>
    setTimeout(() => cb(0), 0) as unknown as number,
  cancelAnimationFrame: (id: number) => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  },
});

initI18n("en");

function mountFixture(
  value: string,
  {
    onTypewriterModeChange = () => { },
    onWordCountChange = () => { },
  }: {
    onTypewriterModeChange?: (v: boolean) => void;
    onWordCountChange?: (p: { includeSymbols: boolean }) => void;
  } = {},
) {
  const host = doc.createElement("div");
  const editorHost = doc.createElement("div");
  host.append(editorHost);
  doc.body.append(host);

  const editor = mountPlaintextEditor(editorHost as unknown as HTMLElement, { value });
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  const statusBar = mountStatusBar({
    host: host as unknown as HTMLElement,
    editor,
    getSettings: () => settings,
    onTypewriterModeChange,
    onWordCountChange,
  });
  return { host: host as unknown as HTMLElement, editor, statusBar, settings };
}

describe("countText", () => {
  it("counts only letters and numbers in pure-text mode", () => {
    assert.equal(countText("你好，世界。", false), 4);
    assert.equal(countText("hello, world!", false), 10);
  });

  it("counts punctuation when includeSymbols is on", () => {
    assert.equal(countText("你好，世界。", true), 6);
    assert.equal(countText("hello, world!", true), 12);
  });

  it("never counts whitespace, including ideographic first-line indent", () => {
    assert.equal(countText("　　hello", false), 5);
    assert.equal(countText("　　hello", true), 5);
    assert.equal(countText("第一段\n第二段", false), 6);
  });
});

describe("formatPlaintext", () => {
  it("normalizes blank lines, spaces, and CJK boundaries", () => {
    assert.equal(
      formatPlaintext("第一段   text\n\n\n第二段text", {
        collapseBlankLines: true,
        indentParagraphs: false,
        separateParagraphs: true,
        trimExtraSpaces: true,
        cjkSpacing: true,
      }),
      "第一段 text\n\n第二段 text",
    );
  });

  it("indents every non-empty plain-text paragraph", () => {
    assert.equal(
      formatPlaintext("第一行\n第二行\n\n第三行", {
        collapseBlankLines: false,
        indentParagraphs: true,
        separateParagraphs: false,
        trimExtraSpaces: false,
        cjkSpacing: false,
      }, 3),
      "　　　第一行\n　　　第二行\n\n　　　第三行",
    );
  });
});

describe("mountStatusBar", () => {
  it("opens the format panel with the requested default rules and applies them", () => {
    const { host, editor, statusBar } = mountFixture("第一段   text\n\n\n第二段text");
    const formatBtn = host.querySelector<HTMLButtonElement>(".vellum-format-btn");
    assert.ok(formatBtn);
    formatBtn.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    const formatPanel = host.querySelector<HTMLElement>(".vellum-format-panel");
    assert.ok(formatPanel);
    assert.equal(formatPanel.hidden, false);
    assert.deepEqual(
      [...formatPanel.querySelectorAll<HTMLButtonElement>(".inimark-toggle")].map((toggle) =>
        toggle.getAttribute("aria-checked"),
      ),
      ["false", "true", "false", "false", "true"],
    );

    const apply = host.querySelector<HTMLButtonElement>(".vellum-format-apply");
    assert.ok(apply);
    apply.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    assert.equal(editor.getValue(), "　　第一段   text\n\n\n　　第二段 text");

    editor.destroy();
    statusBar.destroy();
    host.remove();
  });

  it("uses the configured first-line indent when formatting paragraphs", () => {
    const { host, editor, statusBar, settings } = mountFixture("第一段");
    settings.firstLineIndent = 3;
    const formatBtn = host.querySelector<HTMLButtonElement>(".vellum-format-btn");
    assert.ok(formatBtn);
    formatBtn.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    const formatPanel = host.querySelector<HTMLElement>(".vellum-format-panel");
    assert.ok(formatPanel);

    const apply = host.querySelector<HTMLButtonElement>(".vellum-format-apply");
    assert.ok(apply);
    apply.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    assert.equal(editor.getValue(), "　　　第一段");

    editor.destroy();
    statusBar.destroy();
    host.remove();
  });

  it("renders the shared typewriter glyph", () => {
    const { host, editor, statusBar } = mountFixture("hello");
    const icon = host.querySelector('svg[data-icon="typewriter"]');
    assert.ok(icon);
    assert.ok(icon.querySelector('path[d="M8 10V4h8v6"]'));
    assert.ok(icon.querySelector('path[d="M8 17h8"]'));
    editor.destroy();
    statusBar.destroy();
    host.remove();
  });

  it("renders a whitespace-excluded character count", () => {
    const { host, editor, statusBar } = mountFixture("你好 世界\n第二段");
    const count = host.querySelector(".vellum-status-count");
    assert.equal(count?.textContent, "7 chars");
    editor.destroy();
    statusBar.destroy();
    host.remove();
  });

  it("toggles typewriter mode and reports the change", () => {
    const changes: boolean[] = [];
    const { host, editor, statusBar } = mountFixture("hello", {
      onTypewriterModeChange: (v) => changes.push(v),
    });
    assert.equal(editor.isTypewriterMode(), false);

    const btn = host.querySelector<HTMLButtonElement>(".vellum-typewriter-btn");
    assert.ok(btn);
    btn.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));

    assert.equal(editor.isTypewriterMode(), true);
    assert.deepEqual(changes, [true]);
    assert.equal(btn.getAttribute("aria-pressed"), "true");

    btn.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    assert.equal(editor.isTypewriterMode(), false);
    assert.deepEqual(changes, [true, false]);

    editor.destroy();
    statusBar.destroy();
    host.remove();
  });

  it("syncChrome applies the stored typewriter setting to the editor", () => {
    const { editor, statusBar, settings } = mountFixture("hello");
    settings.typewriterMode = true;
    statusBar.syncChrome();
    assert.equal(editor.isTypewriterMode(), true);
    editor.destroy();
    statusBar.destroy();
  });

  it("opens a panel that switches counting to include symbols", () => {
    const patches: Array<{ includeSymbols: boolean }> = [];
    const { host, editor, statusBar, settings } = mountFixture("你好，世界。", {
      onWordCountChange: (p) => {
        settings.wordCount = { ...settings.wordCount, ...p };
        patches.push(p);
      },
    });

    const count = host.querySelector<HTMLButtonElement>(".vellum-status-count");
    assert.ok(count);
    assert.equal(count.textContent, "4 chars");

    count.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));
    const panel = host.querySelector<HTMLElement>(".vellum-word-count-panel");
    assert.ok(panel);
    assert.equal(panel.hidden, false);

    const toggle = panel.querySelector<HTMLButtonElement>(".inimark-toggle");
    assert.ok(toggle);
    toggle.dispatchEvent(new happy.MouseEvent("click", { bubbles: true }));

    assert.deepEqual(patches, [{ includeSymbols: true }]);
    // The count re-reads the (updated) settings and includes punctuation.
    assert.equal(count.textContent, "6 chars");

    editor.destroy();
    statusBar.destroy();
    host.remove();
  });
});
