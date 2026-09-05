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
});
