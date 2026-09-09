import { describe, expect, test } from "vitest";

import {
  WIKI_AUTOCOMPLETE_HEADING_HEIGHT,
  WIKI_AUTOCOMPLETE_ROW_HEIGHT,
  buildDisplayRows,
  resolveWikiAutocompleteMatches,
} from "../../src/features/wiki-link-autocomplete-popup.ts";
import type { WikiLinkBridge } from "../../src/wiki-link-bridge.ts";

function mockBridge(
  notes: Array<{ name: string; path: string }>,
  recent: Array<{ name: string; path: string }> = [],
): WikiLinkBridge {
  return {
    resolveNote: (noteName) =>
      notes.find((n) => n.name === noteName)?.path ?? null,
    resolveImage: () => null,
    searchNotes(query, limit?) {
      const q = query.trim().toLowerCase();
      const hits = notes.filter((note) => {
        if (!q) return true;
        const base = (note.name.split("/").pop() ?? note.name).toLowerCase();
        return base.includes(q) || note.name.toLowerCase().includes(q);
      });
      return limit == null ? hits : hits.slice(0, limit);
    },
    recentNotes(limit = 5) {
      return recent.slice(0, limit);
    },
    openNote() {},
  };
}

describe("resolveWikiAutocompleteMatches", () => {
  test("empty query merges recent ahead of the rest without duplicates", () => {
    const bridge = mockBridge(
      [
        { name: "Alpha", path: "Alpha.md" },
        { name: "Beta", path: "Beta.md" },
        { name: "Gamma", path: "Gamma.md" },
      ],
      [{ name: "Gamma", path: "Gamma.md" }],
    );
    const { matches, recentCount } = resolveWikiAutocompleteMatches(bridge, "");
    expect(recentCount).toBe(1);
    expect(matches.map((m) => m.name)).toEqual(["Gamma", "Alpha", "Beta"]);
  });

  test("filter query caps at 50 results", () => {
    const notes = Array.from({ length: 80 }, (_, i) => ({
      name: `Note${i}`,
      path: `Note${i}.md`,
    }));
    const { matches, recentCount } = resolveWikiAutocompleteMatches(
      mockBridge(notes),
      "note",
    );
    expect(recentCount).toBe(0);
    expect(matches).toHaveLength(50);
  });
});

describe("buildDisplayRows", () => {
  const hits = [
    { name: "Gamma", path: "Gamma.md" },
    { name: "Alpha", path: "Alpha.md" },
    { name: "Beta", path: "Beta.md" },
  ];

  test("browse mode shows 最近 and 全部 headings", () => {
    const rows = buildDisplayRows(hits, 1, false);
    expect(
      rows
        .filter((row) => row.kind === "heading")
        .map((row) => row.label),
    ).toEqual(["最近", "全部"]);
    expect(rows.filter((row) => row.kind === "note")).toHaveLength(3);
  });

  test("filter mode omits section headings", () => {
    const rows = buildDisplayRows(hits, 0, true);
    expect(rows.every((row) => row.kind === "note")).toBe(true);
  });
});

describe("wiki-link autocomplete popup sizing", () => {
  test("virtual spacer height reflects full browse list", () => {
    const notes = Array.from({ length: 12 }, (_, i) => ({
      name: `Note${String(i).padStart(2, "0")}`,
      path: `Note${String(i).padStart(2, "0")}.md`,
    }));
    const { matches, recentCount } = resolveWikiAutocompleteMatches(
      mockBridge(notes),
      "",
    );
    const rows = buildDisplayRows(matches, recentCount, false);
    const height = rows.reduce(
      (sum, row) =>
        sum +
        (row.kind === "heading"
          ? WIKI_AUTOCOMPLETE_HEADING_HEIGHT
          : WIKI_AUTOCOMPLETE_ROW_HEIGHT),
      0,
    );
    expect(matches).toHaveLength(12);
    expect(recentCount).toBe(0);
    expect(height).toBe(
      WIKI_AUTOCOMPLETE_HEADING_HEIGHT + 12 * WIKI_AUTOCOMPLETE_ROW_HEIGHT,
    );
  });
});
