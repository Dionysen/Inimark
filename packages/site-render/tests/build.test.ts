import { describe, expect, it } from "vitest";
import { buildSite } from "../src/index.ts";

describe("buildSite", () => {
  it("renders notes with outline, wiki links, titles, and collapsed folders", async () => {
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

    const result = await buildSite({
      config: { siteName: "Test Vault", defaultTheme: "ocean", baseHref: "/", out: "dist" },
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
        ':root { --bg-primary: #111; }\n[data-theme="ocean"] { --bg-primary: #111; }\n[data-theme="light"] { --bg-primary: #fff; }',
      editorWidgetsCss: "/* widgets */",
      editorThemeCss: "/* typora */",
      themeIds: ["light", "ocean"],
    });

    expect(result.pageCount).toBe(2);

    const welcome = result.files.find((f) => f.path === "notes/folder/Welcome.html")!;
    const other = result.files.find((f) => f.path === "notes/folder/Other.html")!;
    expect(welcome.content).toContain("Welcome Home");
    expect(welcome.content).not.toContain("<yaml-block");
    expect(welcome.content).toContain('aria-expanded="true"'); // ancestor of active
    expect(welcome.content).toContain("site-theme-toggle");
    expect(welcome.content).toContain('data-theme-light="light"');
    expect(welcome.content).toContain('data-theme-dark="ocean"');
    expect(welcome.content).toContain("data-tree-path=");
    expect(welcome.content).not.toContain('id="site-theme"');
    expect(welcome.content).toContain("inimark-site-tree");
    expect(welcome.content).toContain("data-tree-ready");
    expect(result.files.find((f) => f.path === "assets/site.js")!.content).toContain(
      "inimark-site-tree",
    );
    expect(welcome.content).toContain("wiki-link-widget");
    expect(welcome.content).toContain("Outline");
    expect(welcome.content).toContain("Graph");
    expect(welcome.content).toContain("site-graph-canvas");
    expect(welcome.content).toContain('data-graph-mode="local"');
    expect(welcome.content).toContain('data-graph-mode="global"');
    expect(welcome.content).toContain("assets/graph.json");
    expect(result.files.some((f) => f.path === "assets/graph.json")).toBe(true);
    const siteJs = result.files.find((f) => f.path === "assets/site.js")!;
    expect(siteJs.content).toContain("__INIMARK_GLOBAL_GRAPH__");
    expect(siteJs.content).toContain("Welcome Home");
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

  it("keeps folders collapsed when they do not contain the active note", async () => {
    const notes = [
      { path: "a/One.md", markdown: "# One" },
      { path: "b/Two.md", markdown: "# Two" },
    ];
    const result = await buildSite({
      config: { siteName: "T", defaultTheme: "ocean", baseHref: "/", out: "dist" },
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
      themeIds: ["ocean"],
    });

    const one = result.files.find((f) => f.path === "notes/a/One.html")!;
    expect(one.content).toMatch(/site-tree-dir[^>]*>[\s\S]*aria-expanded="true"/);
    expect(one.content).toContain('aria-expanded="false"');
  });

  it("builds bilingual sites with language switcher and unwrapped nav", async () => {
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
    const result = await buildSite({
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

  it("emits Mermaid sources and ships the runtime for client hydration", async () => {
    const result = await buildSite({
      config: { siteName: "Diagrams", defaultTheme: "light", baseHref: "/", out: "dist" },
      notes: [
        {
          path: "Chart.md",
          markdown: "# Chart\n\n```mermaid\nflowchart LR\n  A --> B\n```\n",
        },
      ],
      resolveNotePath: () => null,
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss: "",
      editorWidgetsCss: "",
      editorThemeCss: "",
      themeIds: ["light"],
      mermaidRuntimeJs: "/* mermaid stub */\nwindow.mermaid = {};",
    });

    const page = result.files.find((f) => f.path === "notes/Chart.html")!;
    expect(page.content).toContain('pre class="mermaid"');
    expect(page.content).toContain("flowchart LR");
    expect(page.content).toContain("assets/mermaid.min.js");
    expect(page.content).toContain("data-inimark-mermaid");
    expect(page.content).toContain("inimark-site-theme");
    expect(result.files.some((f) => f.path === "assets/mermaid.min.js")).toBe(true);
    expect(result.files.find((f) => f.path === "assets/site.js")!.content).toContain(
      "buildMermaidThemeVariables",
    );
    expect(result.files.find((f) => f.path === "assets/site.js")!.content).toContain(
      'theme: "base"',
    );
    expect(result.files.find((f) => f.path === "assets/site.js")!.content).toContain(
      "resolveMermaidFontSize",
    );
    expect(result.files.find((f) => f.path === "assets/site.js")!.content).toContain(
      "fitMermaidSvg",
    );
  });

  it("syntax-highlights fenced code in published HTML", async () => {
    const result = await buildSite({
      config: { siteName: "Code", defaultTheme: "light", baseHref: "/", out: "dist" },
      notes: [
        {
          path: "Snippet.md",
          markdown: "# Snippet\n\n```python\ndef hello():\n  return 1\n```\n",
        },
      ],
      resolveNotePath: () => null,
      resolveMediaAbsolutePath: () => null,
      themeVariablesCss: ":root { --tw-code-keyword: #c9a7e8; }",
      editorWidgetsCss: "",
      editorThemeCss: "",
      themeIds: ["light"],
    });

    const page = result.files.find((f) => f.path === "notes/Snippet.html")!;
    expect(page.content).toContain('data-lang="python"');
    expect(page.content).toContain("language-python");
    expect(page.content).toMatch(/tok-(keyword|function|literal)/);
    expect(page.content).toContain("tok-keyword");
    expect(result.files.find((f) => f.path === "assets/site.css")!.content).toContain(
      ".tok-keyword",
    );
  });
});
