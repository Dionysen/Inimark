import { describe, expect, it } from "vitest";
import { mediaOutPath, stripFileUrl } from "../src/paths.ts";

describe("mediaOutPath", () => {
  it("maps Windows absolute paths under media/ext without drive colon", () => {
    expect(
      mediaOutPath(
        "C:/Users/zhaoys-c/Desktop/imgimage-20240905094448319.png",
        "docs/a.md",
      ),
    ).toBe("media/ext/C/Users/zhaoys-c/Desktop/imgimage-20240905094448319.png");
  });

  it("keeps vault-relative images under media/", () => {
    expect(mediaOutPath("images/pic.png", "folder/note.md")).toBe(
      "media/folder/images/pic.png",
    );
  });

  it("strips file URLs", () => {
    expect(stripFileUrl("file:///C:/Users/a/b.png")).toBe("C:/Users/a/b.png");
  });
});
