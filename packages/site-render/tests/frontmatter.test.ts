import { describe, expect, it } from "vitest";
import { parseFrontmatterTitle, parseSiteFrontmatter } from "../src/frontmatter.ts";

describe("parseFrontmatterTitle", () => {
  it("reads quoted and bare titles", () => {
    expect(parseFrontmatterTitle("---\ntitle: Hello\n---\n\n# x", "fb")).toBe("Hello");
    expect(parseFrontmatterTitle("---\ntitle: \"Hi there\"\n---\nbody", "fb")).toBe("Hi there");
  });

  it("falls back when missing", () => {
    expect(parseFrontmatterTitle("# just a heading", "Note")).toBe("Note");
  });
});

describe("parseSiteFrontmatter", () => {
  it("reads title, lang, and translationKey", () => {
    expect(
      parseSiteFrontmatter(
        "---\ntitle: Welcome\nlang: en\ntranslationKey: welcome\n---\n\n# Welcome",
      ),
    ).toEqual({
      title: "Welcome",
      lang: "en",
      translationKey: "welcome",
    });
  });

  it("returns empty object without front matter", () => {
    expect(parseSiteFrontmatter("# bare")).toEqual({});
  });
});
