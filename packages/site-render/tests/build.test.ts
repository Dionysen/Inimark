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
    expect(welcome.content).toContain("Graph");
    expect(welcome.content).toContain("site-graph-canvas");
    expect(welcome.content).toContain("site-links-footer");
    expect(welcome.content).toContain("Backlinks");
    expect(welcome.content).toContain("Outgoing");
    // Links footer comes after article; graph sits in the right rail.
    expect(welcome.content.indexOf("site-article")).toBeLessThan(
      welcome.content.indexOf("site-links-footer"),
    );
    expect(welcome.content.indexOf("site-graph")).toBeLessThan(
      welcome.content.indexOf('aria-label="Outline"'),
    );
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

  it("builds bilingual sites with language switcher and unwrapped nav", () => {
    const locales = {
      default: "zh",
      languages: [
        { id: "zh", label: "中文", root: "zh", home: "zh/欢迎.md" },
        { id: "en", label: "English", root: "en", home: "en/Welcome.md" },
      ],
    };
    const notes = [
      {
        path: "README.md",
        markdown: "---\ntitle: Hub\n---\n\n# Hub",
      },
      {
        path: "zh/欢迎.md",
        markdown:
          "---\ntitle: 欢迎\nlang: zh\ntranslationKey: welcome\n---\n\n# 欢迎\n\nSee [[Welcome]].",
      },
      {
        path: "en/Welcome.md",
        markdown:
          "---\ntitle: Welcome\nlang: en\ntranslationKey: welcome\n---\n\n# Welcome\n\nSee [[欢迎]].",
      },
    ];
    const result = buildSite({
      config: {
        siteName: "Docs",
        defaultTheme: "light",
        baseHref: "/",
        out: "dist",
        home: "zh/欢迎.md",
        locales,
      },
      notes,
      tree: [
        { name: "README.md", path: "README.md", kind: "file" },
        {
          name: "zh",
          path: "zh",
          kind: "directory",
          children: [{ name: "欢迎.md", path: "zh/欢迎.md", kind: "file" }],
        },
        {
          name: "en",
          path: "en",
          kind: "directory",
          children: [{ name: "Welcome.md", path: "en/Welcome.md", kind: "file" }],
        },
      ],
      resolveNotePath: (name) => {
        if (name === "Welcome" || name === "en/Welcome") return "en/Welcome.md";
        if (name === "欢迎" || name === "zh/欢迎") return "zh/欢迎.md";
        return null;
      },
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss: "",
      editorWidgetsCss: "",
      editorThemeCss: "",
      themeIds: ["light"],
    });

    expect(result.pageCount).toBe(2);
    expect(result.files.find((f) => f.path === "notes/README.html")).toBeUndefined();

    const localeMap = result.files.find((f) => f.path === "assets/locale-map.json")!;
    expect(JSON.parse(localeMap.content).translations.welcome).toEqual({
      zh: "notes/zh/欢迎.html",
      en: "notes/en/Welcome.html",
    });

    const zh = result.files.find((f) => f.path === "notes/zh/欢迎.html")!;
    const en = result.files.find((f) => f.path === "notes/en/Welcome.html")!;
    const index = result.files.find((f) => f.path === "index.html")!;

    expect(zh.content).toContain('html lang="zh"');
    expect(zh.content).toContain("site-lang-btn");
    expect(zh.content).toContain('data-lang="en"');
    expect(zh.content).toMatch(/href="[^"]*Welcome\.html"/);
    // Locale roots are unwrapped — nav shows the note, not a `zh` folder.
    expect(zh.content).toMatch(/site-tree-label">欢迎</);
    expect(zh.content).not.toMatch(/site-tree-label">zh</);
    expect(zh.content).not.toMatch(/site-tree-label">en</);

    expect(en.content).toContain('html lang="en"');
    expect(en.content).toMatch(/site-tree-label">Welcome</);
    expect(en.content).not.toMatch(/site-tree-label">zh</);
    expect(en.content).not.toMatch(/site-tree-label">en</);

    expect(index.content).toContain("notes/zh/欢迎.html");
  });
});
