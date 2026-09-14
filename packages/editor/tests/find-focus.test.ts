import { describe, expect, test } from "vitest";

import { createEditor } from "../src/lib.ts";

function withEditor(
  initialContent: string,
  run: (editor: ReturnType<typeof createEditor>, host: HTMLElement) => void | Promise<void>,
): Promise<void> {
  const host = document.createElement("div");
  document.body.append(host);
  const editor = createEditor(host, { initialContent });
  return Promise.resolve(run(editor, host)).finally(() => {
    editor.destroy();
    host.remove();
  });
}

/** Simulates the find-bar input holding focus while configureFind/findNext run. */
function withExternalFocus(
  run: (input: HTMLInputElement) => void | Promise<void>,
): Promise<void> {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  expect(document.activeElement).toBe(input);
  return Promise.resolve(run(input)).finally(() => {
    input.remove();
  });
}

describe("find session focus", () => {
  test("configureFind does not steal focus in rendered mode", async () => {
    await withEditor("alpha beta alpha", async (editor) => {
      await withExternalFocus((input) => {
        editor.configureFind({ query: "a" });
        expect(document.activeElement).toBe(input);
        editor.configureFind({ query: "al" });
        expect(document.activeElement).toBe(input);
        editor.findNext();
        expect(document.activeElement).toBe(input);
      });
    });
  });

  test("configureFind does not steal focus in source mode", async () => {
    await withEditor("alpha beta alpha", async (editor) => {
      editor.toggleSource();
      expect(editor.isSourceMode()).toBe(true);
      await withExternalFocus(async (input) => {
        editor.configureFind({ query: "a" });
        await Promise.resolve(); // source applyFindSession uses queueMicrotask
        expect(document.activeElement).toBe(input);
        editor.configureFind({ query: "al" });
        await Promise.resolve();
        expect(document.activeElement).toBe(input);
      });
    });
  });
});
