import { describe, expect, test } from "vitest";

import { createAiChangeSet } from "../src/ai/change-set.ts";
import { countLineChanges, diffLines, splitLines } from "../src/ai/line-diff.ts";

describe("splitLines / diffLines", () => {
  test("counts added and removed lines", () => {
    const before = "a\nb\nc";
    const after = "a\nx\nc\nd";
    const result = diffLines(before, after);
    expect(result.removed).toBe(1);
    expect(result.added).toBe(2);
    expect(result.lines.some((l) => l.kind === "remove" && l.text === "b")).toBe(true);
    expect(result.lines.some((l) => l.kind === "add" && l.text === "x")).toBe(true);
    expect(result.lines.some((l) => l.kind === "add" && l.text === "d")).toBe(true);
  });

  test("identical texts produce no changes", () => {
    expect(countLineChanges("same\n", "same\n")).toEqual({ added: 0, removed: 0 });
  });

  test("empty to content is all adds", () => {
    expect(countLineChanges("", "hello\nworld")).toEqual({ added: 2, removed: 0 });
    expect(splitLines("")).toEqual([]);
  });
});

describe("AiChangeSet", () => {
  test("keeps original before across stacked writes", () => {
    const set = createAiChangeSet();
    set.record({ path: "a.md", before: "one", after: "two" });
    set.record({ path: "a.md", before: "two", after: "three" });
    const entry = set.get("a.md")!;
    expect(entry.before).toBe("one");
    expect(entry.after).toBe("three");
    expect(entry.added).toBeGreaterThan(0);
  });

  test("aggregates totals across files", () => {
    const set = createAiChangeSet();
    set.record({ path: "a.md", before: "a", after: "a\nb" });
    set.record({ path: "b.md", before: "x\ny", after: "x" });
    const totals = set.totals();
    expect(totals.files).toBe(2);
    expect(totals.added).toBe(1);
    expect(totals.removed).toBe(1);
    set.remove("a.md");
    expect(set.totals().files).toBe(1);
  });
});
