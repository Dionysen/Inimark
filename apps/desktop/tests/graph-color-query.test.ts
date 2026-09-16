import { describe, expect, test } from "vitest";

import {
  matchNoteQuery,
  noteMatchContextFromPath,
  parseGraphQuery,
  resolveNodeColors,
  type GraphColorGroup,
} from "../src/graph/index.ts";

describe("parseGraphQuery", () => {
  test("empty query yields no terms", () => {
    expect(parseGraphQuery("")).toEqual({ raw: "", terms: [] });
    expect(parseGraphQuery("   ")).toEqual({ raw: "", terms: [] });
  });

  test("parses path/file/tag and bare words as AND terms", () => {
    const q = parseGraphQuery("path:docs/en file:Welcome tag:roadmap Hello");
    expect(q.terms).toEqual([
      { kind: "path", value: "docs/en" },
      { kind: "file", value: "Welcome" },
      { kind: "tag", value: "roadmap" },
      { kind: "bare", value: "Hello" },
    ]);
  });

  test("unknown operators and [property] become unknown terms", () => {
    const q = parseGraphQuery("line:foo section:bar [status] [priority:high]");
    expect(q.terms).toEqual([
      { kind: "unknown", op: "line", value: "foo" },
      { kind: "unknown", op: "section", value: "bar" },
      { kind: "unknown", op: "property", value: "status" },
      { kind: "unknown", op: "property", value: "priority:high" },
    ]);
  });
});

describe("matchNoteQuery", () => {
  const docsWelcome = noteMatchContextFromPath("docs/en/Welcome.md", ["roadmap", "core/intro"]);
  const inboxNote = noteMatchContextFromPath("notes/Inbox.md", ["inbox"]);

  test("path: matches case-insensitive path substring", () => {
    expect(matchNoteQuery(docsWelcome, "path:docs/en")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "path:DOCS")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "path:zh")).toBe(false);
  });

  test("file: matches filename and note name", () => {
    expect(matchNoteQuery(docsWelcome, "file:Welcome.md")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "file:Welcome")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "file:inbox")).toBe(false);
  });

  test("tag: matches exact and nested prefix", () => {
    expect(matchNoteQuery(docsWelcome, "tag:roadmap")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "tag:#roadmap")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "tag:core")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "tag:core/intro")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "tag:missing")).toBe(false);
  });

  test("bare word matches note name", () => {
    expect(matchNoteQuery(docsWelcome, "Welcome")).toBe(true);
    expect(matchNoteQuery(inboxNote, "Inbox")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "Inbox")).toBe(false);
  });

  test("AND requires every term; unknown terms never match", () => {
    expect(matchNoteQuery(docsWelcome, "path:docs tag:roadmap")).toBe(true);
    expect(matchNoteQuery(docsWelcome, "path:docs tag:inbox")).toBe(false);
    expect(matchNoteQuery(docsWelcome, "path:docs line:anything")).toBe(false);
    expect(matchNoteQuery(docsWelcome, "[status]")).toBe(false);
  });

  test("empty query never matches", () => {
    expect(matchNoteQuery(docsWelcome, "")).toBe(false);
    expect(matchNoteQuery(docsWelcome, "   ")).toBe(false);
  });
});

describe("resolveNodeColors", () => {
  const paths = ["docs/en/Welcome.md", "notes/Inbox.md", "scratch/Todo.md"];

  function contextFor(path: string) {
    if (path.includes("Welcome")) {
      return noteMatchContextFromPath(path, ["roadmap"]);
    }
    if (path.includes("Inbox")) {
      return noteMatchContextFromPath(path, ["inbox"]);
    }
    return noteMatchContextFromPath(path, []);
  }

  test("first enabled matching group wins", () => {
    const groups: GraphColorGroup[] = [
      { id: "1", query: "path:docs", color: "#e67e22", enabled: true },
      { id: "2", query: "tag:roadmap", color: "#3498db", enabled: true },
      { id: "3", query: "tag:inbox", color: "#2ecc71", enabled: true },
    ];
    const colors = resolveNodeColors(paths, groups, contextFor);
    expect(colors.get("docs/en/Welcome.md")).toBe("#e67e22");
    expect(colors.get("notes/Inbox.md")).toBe("#2ecc71");
    expect(colors.has("scratch/Todo.md")).toBe(false);
  });

  test("disabled and empty queries are skipped", () => {
    const groups: GraphColorGroup[] = [
      { id: "1", query: "path:docs", color: "#e67e22", enabled: false },
      { id: "2", query: "", color: "#3498db", enabled: true },
      { id: "3", query: "tag:roadmap", color: "#9b59b6", enabled: true },
    ];
    const colors = resolveNodeColors(paths, groups, contextFor);
    expect(colors.get("docs/en/Welcome.md")).toBe("#9b59b6");
  });
});
