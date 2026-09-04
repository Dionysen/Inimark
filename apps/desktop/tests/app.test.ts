import { describe, expect, test } from "vitest";

import { mountApp } from "../src/app.ts";

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
});
