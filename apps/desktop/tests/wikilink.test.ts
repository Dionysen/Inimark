import { describe, expect, test } from "vitest";

import { parseWikiLinks, isImageWikiTarget } from "../src/wikilink/parser.ts";
import { linkIndex } from "../src/wikilink/link-index.ts";

describe("parseWikiLinks", () => {
  test("parses note, heading, alias, and embed", () => {
    const md = `See [[Note]] and [[folder/Note#Heading|Alias]] plus ![[pic.png]]`;
    const links = parseWikiLinks(md);
    expect(links).toHaveLength(3);
    expect(links[0]).toMatchObject({
      noteName: "Note",
      isEmbed: false,
    });
    expect(links[1]).toMatchObject({
      noteName: "folder/Note",
      heading: "Heading",
      alias: "Alias",
      isEmbed: false,
    });
    expect(links[2]).toMatchObject({
      noteName: "pic.png",
      isEmbed: true,
    });
    expect(isImageWikiTarget("pic.png")).toBe(true);
  });
});

describe("linkIndex", () => {
  test("tracks outlinks and backlinks", () => {
    linkIndex.clear();
    linkIndex.registerFile("A.md");
    linkIndex.registerFile("B.md");
    linkIndex.registerFile("folder/C.md");
    linkIndex.addFileLinks("A.md", "Hello [[B]] and [[folder/C]]");
    linkIndex.addFileLinks("B.md", "Back to [[A]]");

    expect(linkIndex.getOutlinks("A.md")).toEqual(["B", "folder/C"]);
    expect(linkIndex.getBacklinks("A")).toContain("B.md");
    expect(linkIndex.findFileByNoteName("B")).toBe("B.md");
    expect(linkIndex.findFileByNoteName("C")).toBe("folder/C.md");
    expect(linkIndex.searchNotes("fol").some((h) => h.name === "folder/C")).toBe(
      true,
    );
  });

  test("rewrites path-qualified links on move and remaps index", async () => {
    linkIndex.clear();
    linkIndex.registerFile("old/Note.md");
    linkIndex.registerFile("Index.md");
    linkIndex.addFileLinks("Index.md", "See [[old/Note]] and [[old/Note#x]]");

    const files = new Map<string, string>([
      ["Index.md", "See [[old/Note]] and [[old/Note#x]]"],
      ["old/Note.md", "hello"],
    ]);

    const affected = linkIndex.getAffectedLinkCountForRenames([
      { from: "old/Note.md", to: "new/Note.md" },
    ]);
    expect(affected.filesCount).toBe(1);
    expect(affected.linksCount).toBe(2);

    const result = await linkIndex.rewriteWikiLinksBatch(
      [{ from: "old/Note.md", to: "new/Note.md" }],
      async (path) => files.get(path) ?? null,
      async (path, content) => {
        files.set(path, content);
      },
    );
    expect(result.filesUpdated).toBe(1);
    expect(result.linksUpdated).toBe(2);
    expect(files.get("Index.md")).toBe("See [[new/Note]] and [[new/Note#x]]");
    expect(linkIndex.findFileByNoteName("new/Note")).toBe("new/Note.md");
    expect(linkIndex.getBacklinks("new/Note")).toContain("Index.md");
  });
});
