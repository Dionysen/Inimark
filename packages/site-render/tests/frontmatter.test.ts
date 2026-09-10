import { describe, expect, it } from "vitest";
import { parseFrontmatterTitle } from "../src/frontmatter.ts";

describe("parseFrontmatterTitle", () => {
  it("reads quoted and bare titles", () => {
    expect(parseFrontmatterTitle("---\ntitle: Hello\n---\n\n# x", "fb")).toBe("Hello");
    expect(parseFrontmatterTitle("---\ntitle: \"Hi there\"\n---\nbody", "fb")).toBe("Hi there");
  });

  it("falls back when missing", () => {
    expect(parseFrontmatterTitle("# just a heading", "Note")).toBe("Note");
  });
});
