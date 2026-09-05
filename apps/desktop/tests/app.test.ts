import { describe, expect, test } from "vitest";

import { mountApp } from "../src/app.ts";
import { mountShell } from "../src/shell.ts";
import type { Workspace } from "../src/platform/types.ts";

describe("desktop app shell", () => {
  test("mounts editor and exposes markdown API", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const app = mountApp(host);
    expect(app.editor.getMarkdown()).toContain("Welcome");

    app.editor.setMarkdown("# Hello from test");
    expect(app.editor.getMarkdown()).toBe("# Hello from test");

    app.destroy();
    host.remove();
  });

  test("renders sidebar and titlebar", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const shell = mountShell(host);
    expect(host.querySelector(".inimark-titlebar")).not.toBeNull();
    expect(host.querySelector(".inimark-sidebar")).not.toBeNull();
    expect(host.querySelector(".inimark-right-sidebar")).not.toBeNull();
    expect(host.querySelector(".inimark-outline-panel")).not.toBeNull();
    expect(host.querySelector(".inimark-tree")).not.toBeNull();
    expect(host.querySelector(".inimark-library-bar")).not.toBeNull();
    expect(host.querySelector(".inimark-sidebar-toggle-btn")).not.toBeNull();
    expect(host.querySelector(".inimark-toolbar")).toBeNull();
    expect(host.querySelector(".inimark-statusbar")).toBeNull();

    const workspace: Workspace = {
      rootPath: "/vault",
      rootName: "vault",
      tree: [
        {
          name: "notes",
          path: "notes",
          kind: "directory",
          children: [{ name: "intro.md", path: "notes/intro.md", kind: "file" }],
        },
      ],
    };

    shell.sidebar.setWorkspace(workspace);
    shell.sidebar.setExpandedDirs(["notes"]);
    expect(host.querySelector(".inimark-tree-item--file")?.textContent).toContain("intro.md");

    shell.destroy();
    host.remove();
  });
});
