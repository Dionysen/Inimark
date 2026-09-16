import { describe, expect, test } from "vitest";

import {
  applyGraphSuggestion,
  collectPathSuggestions,
  graphQueryTokenAt,
  suggestGraphQuery,
  type GraphSuggestCatalog,
} from "../src/graph/suggest.ts";

const catalog: GraphSuggestCatalog = {
  tags: ["inbox", "roadmap", "core/intro"],
  notes: [
    { name: "Welcome", path: "docs/en/Welcome.md" },
    { name: "Inbox", path: "notes/Inbox.md" },
    { name: "Todo", path: "scratch/Todo.md" },
  ],
};

describe("graphQueryTokenAt", () => {
  test("finds the token under the caret", () => {
    expect(graphQueryTokenAt("path:docs tag:in", 16)).toEqual({
      from: 10,
      to: 16,
      text: "tag:in",
    });
    expect(graphQueryTokenAt("path:docs ", 10)).toEqual({
      from: 10,
      to: 10,
      text: "",
    });
  });
});

describe("suggestGraphQuery", () => {
  test("empty token suggests operators", () => {
    const result = suggestGraphQuery("", 0, catalog);
    expect(result.items.map((i) => i.insert)).toEqual(["path:", "file:", "tag:"]);
  });

  test("partial operator name filters operators", () => {
    const result = suggestGraphQuery("ta", 2, catalog);
    expect(result.items.map((i) => i.insert)).toEqual(["tag:"]);
  });

  test("tag: suggests matching tags", () => {
    const result = suggestGraphQuery("tag:in", 6, catalog);
    expect(result.items.map((i) => i.insert)).toEqual(["tag:inbox", "tag:core/intro"]);
  });

  test("path: suggests folders and files", () => {
    const result = suggestGraphQuery("path:doc", 8, catalog);
    expect(result.items.some((i) => i.insert === "path:docs")).toBe(true);
    expect(result.items.some((i) => i.insert === "path:docs/en")).toBe(true);
    expect(result.items.some((i) => i.insert === "path:docs/en/Welcome.md")).toBe(true);
  });

  test("file: suggests note names", () => {
    const result = suggestGraphQuery("file:Wel", 8, catalog);
    expect(result.items.some((i) => i.insert === "file:Welcome")).toBe(true);
  });

  test("applyGraphSuggestion replaces the active token", () => {
    const applied = applyGraphSuggestion("path:docs tag:in", 10, 16, "tag:inbox");
    expect(applied.query).toBe("path:docs tag:inbox");
    expect(applied.caret).toBe("path:docs tag:inbox".length);
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
