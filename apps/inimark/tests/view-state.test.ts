import { beforeEach, describe, expect, test } from "vitest";

import {
  captureFileViewState,
  MAX_FILE_VIEWS,
  remapFileViews,
  removeFileView,
  touchFileView,
} from "../src/editor/view-state.ts";

describe("file view state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("remaps stored paths after renames", () => {
    const views = remapFileViews(
      {
        "notes/a.md": { anchor: 1, scrollTop: 10, updatedAt: 1 },
        "notes/sub/b.md": { anchor: 2, scrollTop: 20, updatedAt: 2 },
      },
      [{ from: "notes", to: "archive" }],
    );

    expect(views["archive/a.md"]).toEqual({ anchor: 1, scrollTop: 10, updatedAt: 1 });
    expect(views["archive/sub/b.md"]).toEqual({ anchor: 2, scrollTop: 20, updatedAt: 2 });
  });

  test("removes deleted file paths", () => {
    const views = removeFileView(
      {
        "readme.md": { anchor: 1, scrollTop: 10 },
        "notes/a.md": { anchor: 2, scrollTop: 20 },
        "notes/sub/b.md": { anchor: 3, scrollTop: 30 },
      },
      "notes",
    );

    expect(views["readme.md"]).toBeDefined();
    expect(views["notes/a.md"]).toBeUndefined();
    expect(views["notes/sub/b.md"]).toBeUndefined();
  });

  test("trims old entries when over the limit", () => {
    let views: Record<string, { anchor: number; scrollTop: number; updatedAt?: number }> = {};
    for (let i = 0; i < MAX_FILE_VIEWS + 5; i += 1) {
      views = touchFileView(views, `file-${i}.md`, {
        anchor: i,
        scrollTop: i * 10,
      });
    }

    expect(Object.keys(views)).toHaveLength(MAX_FILE_VIEWS);
    expect(views["file-0.md"]).toBeUndefined();
    expect(views[`file-${MAX_FILE_VIEWS + 4}.md`]).toBeDefined();
  });

  test("captureFileViewState leaves map unchanged without a path", () => {
    const editor = {
      getViewState: () => ({ anchor: 5, scrollTop: 50 }),
    };
    const views = { "a.md": { anchor: 1, scrollTop: 10 } };
    expect(captureFileViewState(editor, views, null)).toBe(views);
  });
});
