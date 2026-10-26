import { describe, expect, test } from "vitest";

import { buildExportDocument } from "../src/export/build-document.ts";

describe("buildExportDocument", () => {
  test("produces themed HTML with data-theme and article body", async () => {
    const doc = await buildExportDocument({
      markdown: "# Hello\n\nParagraph with **bold**.",
      title: "Hello.md",
      themeId: "light",
      appearance: "light",
    });

    expect(doc.html).toContain('data-theme="light"');
    expect(doc.html).toContain('data-appearance="light"');
    expect(doc.html).toContain("<title>Hello.md</title>");
    expect(doc.html).toContain('class="ProseMirror"');
    expect(doc.html).toContain("var(--bg-primary");
    expect(doc.bodyHtml).toMatch(/Hello/);
    expect(doc.bodyHtml).toMatch(/bold|strong/i);
  });

  test("dark appearance document uses theme bg tokens (not white fallback)", async () => {
    const doc = await buildExportDocument({
      markdown: "hi",
      title: "Dark.md",
      themeId: "dark-modern",
      appearance: "dark",
    });
    expect(doc.html).toContain('data-theme="dark-modern"');
    expect(doc.html).toContain('data-appearance="dark"');
    expect(doc.html).toContain("background: var(--bg-primary");
    expect(doc.html).toContain("color: var(--text-primary");
    expect(doc.html).not.toContain("var(--inimark-content-bg");
    expect(doc.html).toContain("color-scheme: dark");
  });

  test("escapes title in document head", async () => {
    const doc = await buildExportDocument({
      markdown: "hi",
      title: `A <script>alert(1)</script>`,
      themeId: "light",
      appearance: "dark",
    });
    expect(doc.html).toContain("data-appearance=\"dark\"");
    expect(doc.html).not.toContain("<script>alert(1)</script>");
    expect(doc.html).toContain("&lt;script&gt;");
  });
});
