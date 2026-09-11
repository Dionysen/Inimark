import { describe, expect, it } from "vitest";
import { createNotePathResolver } from "../src/vault-fs.ts";

describe("createNotePathResolver", () => {
  it("resolves by full note path and by basename", () => {
    const resolve = createNotePathResolver([
      "zh/00-start/Welcome.md",
      "en/00-start/Hello.md",
    ]);

    expect(resolve("zh/00-start/Welcome")).toBe("zh/00-start/Welcome.md");
    expect(resolve("Welcome")).toBe("zh/00-start/Welcome.md");
    expect(resolve("Hello")).toBe("en/00-start/Hello.md");
    expect(resolve("missing")).toBeNull();
  });

  it("prefers shallower path on basename ties", () => {
    const resolve = createNotePathResolver([
      "deep/nested/Note.md",
      "Note.md",
    ]);
    expect(resolve("Note")).toBe("Note.md");
  });
});
