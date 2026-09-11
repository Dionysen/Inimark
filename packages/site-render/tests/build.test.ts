import { describe, expect, it } from "vitest";
import { buildSite } from "../src/index.ts";

describe("buildSite", () => {
  it("renders notes with outline, wiki links, titles, and collapsed folders", () => {
    const notes = [
      {
        path: "folder/Welcome.md",
        markdown:
          "---\ntitle: Welcome Home\n---\n\n# Welcome\n\nSee [[Other]] for more.\n\n## Details\n\nHello.",
      },
      {
        path: "folder/Other.md",
        markdown: "# Other\n\nBack to [[Welcome]].",
      },
    ];

    const result = buildSite({
      config: { siteName: "Test Vault", defaultTheme: "dark", baseHref: "/", out: "dist" },
      notes,
      tree: [
        {
          name: "folder",
          path: "folder",
          kind: "directory",
          children: [
            { name: "Welcome.md", path: "folder/Welcome.md", kind: "file" },
            { name: "Other.md", path: "folder/Other.md", kind: "file" },
          ],
        },
      ],
      resolveNotePath: (name) => {
        const hit = notes.find(
          (n) =>
            n.path.replace(/\.md$/i, "") === name ||
            n.path.replace(/^.*\//, "").replace(/\.md$/i, "") === name ||
            n.path === name ||
            n.path.endsWith(`/${name}.md`),
        );
        return hit?.path ?? null;
      },
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss:
        ':root { --bg-primary: #111; }\n[data-theme="dark"] { --bg-primary: #111; }\n[data-theme="light"] { --bg-primary: #fff; }',
      editorWidgetsCss: "/* widgets */",
      editorThemeCss: "/* typora */",
      themeIds: ["light", "dark"],
    });

    expect(result.pageCount).toBe(2);

    const welcome = result.files.find((f) => f.path === "notes/folder/Welcome.html")!;
    const other = result.files.find((f) => f.path === "notes/folder/Other.html")!;
    expect(welcome.content).toContain("Welcome Home");
    expect(welcome.content).not.toContain("<yaml-block");
    expect(welcome.content).toContain('aria-expanded="true"'); // ancestor of active
    expect(welcome.content).toContain("site-theme");
    expect(welcome.content).toContain("wiki-link-widget");
    expect(welcome.content).toContain("Outline");
    expect(welcome.content).toContain("Backlinks");
    expect(welcome.content).toContain("Outgoing");
    // Other ← Welcome backlink appears on Other; Welcome outlinks to Other
    expect(welcome.content).toMatch(/Outgoing[\s\S]*Other/);
    expect(other.content).toMatch(/Backlinks[\s\S]*Welcome Home/);
    // sibling page still expands only its ancestor folder
    expect(other.content).toContain('aria-expanded="true"');
  });

  it("keeps folders collapsed when they do not contain the active note", () => {
    const notes = [
      { path: "a/One.md", markdown: "# One" },
      { path: "b/Two.md", markdown: "# Two" },
    ];
    const result = buildSite({
      config: { siteName: "T", defaultTheme: "dark", baseHref: "/", out: "dist" },
      notes,
      tree: [
        {
          name: "a",
          path: "a",
          kind: "directory",
          children: [{ name: "One.md", path: "a/One.md", kind: "file" }],
        },
        {
          name: "b",
          path: "b",
          kind: "directory",
          children: [{ name: "Two.md", path: "b/Two.md", kind: "file" }],
        },
      ],
      resolveNotePath: () => null,
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss: "",
      editorWidgetsCss: "",
      editorThemeCss: "",
      themeIds: ["dark"],
    });

    const one = result.files.find((f) => f.path === "notes/a/One.html")!;
    expect(one.content).toMatch(/site-tree-dir[^>]*>[\s\S]*aria-expanded="true"/);
    expect(one.content).toContain('aria-expanded="false"');
  });
});
