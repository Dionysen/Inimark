import { describe, expect, it } from "vitest";

import {
  hashHex,
  joinNotePath,
  normalizeVaultPath,
  splitNotePath,
} from "../src/paths.ts";
import { libraryToVault, syncLibraryWithVault, vaultToLibrary } from "../src/vault-map.ts";
import type { VaultContent } from "../src/types.ts";

describe("paths", () => {
  it("normalizes slashes", () => {
    expect(normalizeVaultPath("a\\b\\c.md")).toBe("a/b/c.md");
    expect(normalizeVaultPath("./x/y.md")).toBe("x/y.md");
  });

  it("splits note paths into folder / category / title", () => {
    expect(splitNotePath("hello.md")).toEqual({
      folderName: null,
      categoryName: null,
      title: "hello",
      extension: "md",
    });
    expect(splitNotePath("诗/致橡树.txt")).toEqual({
      folderName: "诗",
      categoryName: null,
      title: "致橡树",
      extension: "txt",
    });
    expect(splitNotePath("长篇/大纲/人物.md")).toEqual({
      folderName: "长篇",
      categoryName: "大纲",
      title: "人物",
      extension: "md",
    });
    expect(splitNotePath("长篇/a/b/c.md")).toEqual({
      folderName: "长篇",
      categoryName: "a/b",
      title: "c",
      extension: "md",
    });
  });

  it("joins note paths stably", () => {
    expect(
      joinNotePath({
        folderName: "长篇",
        categoryName: "a/b",
        title: "c",
        extension: "md",
      }),
    ).toBe("长篇/a/b/c.md");
  });

  it("sanitizes Windows-illegal title characters", () => {
    expect(
      joinNotePath({
        folderName: "拾羽",
        categoryName: null,
        title: "一次出游 | 黑光",
        extension: "txt",
      }),
    ).toBe("拾羽/一次出游 _ 黑光.txt");
    expect(
      joinNotePath({
        folderName: "Default",
        categoryName: "小说",
        title: "中学*",
        extension: "txt",
      }),
    ).toBe("Default/小说/中学_.txt");
    expect(
      joinNotePath({
        folderName: "废纸篓",
        categoryName: null,
        title: "",
        extension: "txt",
        fallbackTitle: "abc123",
      }),
    ).toBe("废纸篓/abc123.txt");
  });

  it("hashHex is stable", () => {
    expect(hashHex("article:诗/a.md", 24)).toBe(hashHex("article:诗/a.md", 24));
    expect(hashHex("x", 12)).toHaveLength(12);
  });
});

describe("vault ↔ library mapping", () => {
  const vault: VaultContent = {
    notes: [
      { path: "root-note.md", content: "at root", mtimeMs: 1000, birthtimeMs: 900 },
      { path: "诗/致橡树.txt", content: "我如果爱你\n", mtimeMs: 2000 },
      { path: "长篇/大纲/开篇.md", content: "# 开篇\n\n正文", mtimeMs: 3000 },
      { path: "长篇/a/b/深层.md", content: "deep", mtimeMs: 4000 },
    ],
  };

  it("maps folders, categories, and articles", () => {
    const library = vaultToLibrary(vault, {
      nowMs: 5000,
      defaultFolderName: "Default",
    });

    expect(library.folders.map((f) => f.name).sort()).toEqual(["Default", "长篇", "诗"].sort());
    expect(library.articles).toHaveLength(4);

    const oak = library.articles.find((a) => a.title === "致橡树");
    expect(oak?.extension).toBe("txt");
    expect(oak?.content).toBe("我如果爱你\n");
    expect(oak?.categoryId).toBeNull();

    const deep = library.articles.find((a) => a.title === "深层");
    const deepCat = library.categories.find((c) => c.id === deep?.categoryId);
    expect(deepCat?.name).toBe("a/b");
  });

  it("round-trips vault content (excluding default-only empty concerns)", () => {
    const library = vaultToLibrary(vault, { nowMs: 5000, defaultFolderName: "Default" });
    const back = libraryToVault(library);

    const byPath = new Map(back.notes.map((n) => [n.path, n.content]));
    // Root notes are placed under the default folder name.
    expect(byPath.get("Default/root-note.md")).toBe("at root");
    expect(byPath.get("诗/致橡树.txt")).toBe("我如果爱你\n");
    expect(byPath.get("长篇/大纲/开篇.md")).toBe("# 开篇\n\n正文");
    expect(byPath.get("长篇/a/b/深层.md")).toBe("deep");
  });

  it("syncLibraryWithVault updates content and preserves article ids", () => {
    const library = vaultToLibrary(
      {
        notes: [{ path: "诗/夜.md", content: "旧" }],
      },
      { nowMs: 1000 },
    );
    const id = library.articles[0]!.id;
    const synced = syncLibraryWithVault(library, {
      notes: [
        { path: "诗/夜.md", content: "新正文", mtimeMs: 2000 },
        { path: "诗/晨.md", content: "新增" },
      ],
    }, { nowMs: 2000 });

    expect(synced.articles.find((a) => a.id === id)?.content).toBe("新正文");
    expect(synced.articles.some((a) => a.title === "晨")).toBe(true);
  });
});
