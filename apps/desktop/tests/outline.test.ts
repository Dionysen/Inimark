import { describe, expect, test } from "vitest";

import { buildOutlineTree, parseOutline } from "../src/sidebar/outline.ts";
import { mountOutlinePanel } from "../src/sidebar/outline-panel.ts";

describe("parseOutline", () => {
  test("parses ATX headings and skips fenced code", () => {
    const md = [
      "# Title",
      "",
      "```",
      "# not a heading",
      "```",
      "",
      "## Section",
      "### Nested",
      "## Another",
    ].join("\n");

    const items = parseOutline(md);
    expect(items).toEqual([
      { level: 1, text: "Title", line: 1 },
      { level: 2, text: "Section", line: 7 },
      { level: 3, text: "Nested", line: 8 },
      { level: 2, text: "Another", line: 9 },
    ]);

    const tree = buildOutlineTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toHaveLength(2);
    expect(tree[0]!.children[0]!.children).toHaveLength(1);
  });
});

describe("outline panel", () => {
  test("renders tree rows and toggles level badges", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const panel = mountOutlinePanel(host);
    panel.setContent("# One\n\n## Two");

    expect(host.querySelectorAll(".inimark-outline-item")).toHaveLength(2);
    expect(host.querySelector(".inimark-outline-level")?.textContent).toBe("H1");

    const toggle = host.querySelector(
      ".inimark-panel-toolbar button",
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    toggle!.click();

    expect(host.querySelector(".inimark-outline-level")).toBeNull();

    panel.destroy();
    host.remove();
  });

  test("collapse all and expand to heading level", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const panel = mountOutlinePanel(host);
    panel.setContent("# One\n\n## Two\n\n### Three\n\n## Four");

    expect(host.querySelectorAll(".inimark-outline-item")).toHaveLength(4);

    const buttons = host.querySelectorAll(".inimark-panel-toolbar button");
    const collapseBtn = buttons[1] as HTMLButtonElement;
    const expandToBtn = buttons[2] as HTMLButtonElement;

    collapseBtn.click();
    expect(host.querySelectorAll(".inimark-outline-item")).toHaveLength(1);

    expandToBtn.click();
    const menuItem = Array.from(
      host.querySelectorAll(".inimark-outline-expand-menu .inimark-menu-item"),
    ).find((el) => el.textContent?.includes("Heading 2")) as HTMLButtonElement | undefined;
    expect(menuItem).toBeTruthy();
    menuItem!.click();

    const labels = Array.from(host.querySelectorAll(".inimark-tree-label")).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["One", "Two", "Four"]);

    panel.destroy();
    host.remove();
  });
});
