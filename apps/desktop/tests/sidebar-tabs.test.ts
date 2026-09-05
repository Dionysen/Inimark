import { describe, expect, test } from "vitest";

import {
  ALL_SIDEBAR_TABS,
  DEFAULT_LEFT_SIDEBAR_TABS,
  DEFAULT_RIGHT_SIDEBAR_TABS,
  normalizeSidebarTabLayout,
} from "../src/sidebar/tab-layout.ts";

describe("normalizeSidebarTabLayout", () => {
  test("returns defaults for empty input", () => {
    expect(normalizeSidebarTabLayout(undefined, undefined)).toEqual({
      left: DEFAULT_LEFT_SIDEBAR_TABS,
      right: DEFAULT_RIGHT_SIDEBAR_TABS,
    });
  });

  test("keeps valid cross-side layout and fills missing tabs", () => {
    const layout = normalizeSidebarTabLayout(
      ["outline", "files"],
      ["search"],
    );
    expect(layout.left).toEqual(["outline", "files", "bookmarks"]);
    expect(layout.right).toEqual(["search", "graph"]);
    expect([...layout.left, ...layout.right].sort()).toEqual(
      [...ALL_SIDEBAR_TABS].sort(),
    );
  });

  test("dedupes and drops invalid ids", () => {
    const layout = normalizeSidebarTabLayout(
      ["files", "files", "nope", "outline"],
      ["outline", "search"],
    );
    expect(layout.left).toEqual(["files", "outline", "bookmarks"]);
    expect(layout.right).toEqual(["search", "graph"]);
    expect(new Set([...layout.left, ...layout.right]).size).toBe(
      ALL_SIDEBAR_TABS.length,
    );
  });
});
