import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("task list styling", () => {
  test("task list items hide the unordered bullet marker when a checkbox is present", () => {
    const widgetsCss = readFileSync("src/styles/widgets.css", "utf8");

    expect(widgetsCss).toContain(".ProseMirror li.has-task-marker");
    expect(widgetsCss).toContain("list-style-type: none;");
    expect(widgetsCss).toContain("left: calc(-1 * var(--list-indent, 1.6em));");
    expect(widgetsCss).toContain("border-radius: 50%;");
    expect(widgetsCss).toContain("background: var(--accent");
    expect(widgetsCss).toContain("vertical-align: middle;");
    expect(widgetsCss).toContain("width: 1em;");
    expect(widgetsCss).toContain("aspect-ratio: 1 / 1;");
  });
});
