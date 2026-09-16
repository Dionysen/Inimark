import { describe, expect, test } from "vitest";

import {
  collectPathSuggestions,
  suggestMatchValue,
  type GraphSuggestCatalog,
} from "../src/graph/index.ts";

const catalog: GraphSuggestCatalog = {
  tags: ["inbox", "roadmap", "core/intro"],
  notes: [
    { name: "Welcome", path: "docs/en/Welcome.md" },
    { name: "Inbox", path: "notes/Inbox.md" },
    { name: "Todo", path: "scratch/Todo.md" },
  ],
};

describe("suggestMatchValue", () => {
  test("tag mode suggests matching tags", () => {
    const items = suggestMatchValue("tag", "in", catalog);
    expect(items.map((i) => i.insert)).toEqual(["inbox", "core/intro"]);
  });

  test("path mode suggests folders and files", () => {
    const items = suggestMatchValue("path", "doc", catalog);
    expect(items.some((i) => i.insert === "docs")).toBe(true);
    expect(items.some((i) => i.insert === "docs/en")).toBe(true);
    expect(items.some((i) => i.insert === "docs/en/Welcome.md")).toBe(true);
  });

  test("file mode suggests note names", () => {
    const items = suggestMatchValue("file", "Wel", catalog);
    expect(items.some((i) => i.insert === "Welcome")).toBe(true);
  });

  test("name mode suggests note stems", () => {
    const items = suggestMatchValue("name", "Inb", catalog);
    expect(items.some((i) => i.insert === "Inbox")).toBe(true);
  });
});

describe("collectPathSuggestions", () => {
  test("includes folder prefixes and full paths", () => {
    const paths = collectPathSuggestions(catalog.notes);
    expect(paths).toContain("docs");
    expect(paths).toContain("docs/en");
    expect(paths).toContain("docs/en/Welcome.md");
    expect(paths).toContain("notes");
  });
});
