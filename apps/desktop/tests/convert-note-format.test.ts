import { describe, expect, test } from "vitest";

/** Pure helper mirroring sidebar convert stem + extension choice. */
function convertNoteName(
  name: string,
  siblingLowerNames: string[],
): string | null {
  const isMd = /\.(md|markdown|mdown)$/i.test(name);
  const isTxt = /\.txt$/i.test(name);
  if (!isMd && !isTxt) return null;
  const stem = name.replace(/\.(md|markdown|mdown|txt)$/i, "");
  const ext = isMd ? ".txt" : ".md";
  const existing = new Set(siblingLowerNames.map((n) => n.toLowerCase()));
  const base = `${stem}${ext}`;
  if (!existing.has(base.toLowerCase())) return base;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem} ${i}${ext}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem} ${Date.now()}${ext}`;
}

describe("convert note format naming", () => {
  test("md becomes txt with the same stem", () => {
    expect(convertNoteName("Welcome.md", [])).toBe("Welcome.txt");
    expect(convertNoteName("Note.markdown", [])).toBe("Note.txt");
  });

  test("txt becomes md with the same stem", () => {
    expect(convertNoteName("draft.txt", [])).toBe("draft.md");
  });

  test("avoids colliding sibling names", () => {
    expect(convertNoteName("a.md", ["a.txt"])).toBe("a 1.txt");
    expect(convertNoteName("a.txt", ["a.md", "a 1.md"])).toBe("a 2.md");
  });

  test("ignores non-note files", () => {
    expect(convertNoteName("photo.png", [])).toBeNull();
  });
});
