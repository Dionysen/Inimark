import { describe, expect, it } from "vitest";
import { buildSite } from "../src/index.ts";

describe("buildSite", () => {
  it("renders notes with outline, wiki links, and theme switcher", () => {
    const notes = [
      {
        path: "Welcome.md",
        markdown: "# Welcome\n\nSee [[Other]] for more.\n\n## Details\n\nHello.",
      },
      {
        path: "Other.md",
        markdown: "# Other\n\nBack to [[Welcome]].",
      },
    ];

    const result = buildSite({
      config: { siteName: "Test Vault", defaultTheme: "dark", baseHref: "/", out: "dist" },
      notes,
      resolveNotePath: (name) => {
        const hit = notes.find(
          (n) =>
            n.path.replace(/\.md$/i, "") === name ||
            n.path === name ||
            n.path.endsWith(`/${name}.md`),
        );
        return hit?.path ?? null;
      },
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss: ':root { --bg-primary: #111; }\n[data-theme="dark"] { --bg-primary: #111; }\n[data-theme="light"] { --bg-primary: #fff; }',
      editorWidgetsCss: "/* widgets */",
      editorThemeCss: "/* typora */",
      themeIds: ["light", "dark"],
    });

    expect(result.pageCount).toBe(2);
    expect(result.files.some((f) => f.path === "index.html")).toBe(true);
    expect(result.files.some((f) => f.path === "assets/site.css")).toBe(true);
    expect(result.files.some((f) => f.path === "notes/Welcome.html")).toBe(true);

    const welcome = result.files.find((f) => f.path === "notes/Welcome.html")!;
    expect(welcome.content).toContain('id="welcome"');
    expect(welcome.content).toContain("site-theme");
    expect(welcome.content).toContain("wiki-link-widget");
    expect(welcome.content).toContain('href="Other.html"');
    expect(welcome.content).toContain("Outline");
  });
});
