import { describe, expect, it } from "vitest";
import { parseWikiNoteTargets } from "../src/wiki-links.ts";

describe("parseWikiNoteTargets", () => {
  it("parses links, aliases, headings, and skips image embeds", () => {
    const md = [
      "See [[Welcome]] and [[Welcome|Home]].",
      "Jump [[Markdown Syntax#Tables]].",
      "![[card]]",
      "![[photo.png]]",
    ].join("\n");

    expect(parseWikiNoteTargets(md)).toEqual([
      { noteName: "Welcome", isEmbed: false },
      { noteName: "Welcome", isEmbed: false },
      { noteName: "Markdown Syntax", isEmbed: false },
      { noteName: "card", isEmbed: true },
    ]);
  });
});
