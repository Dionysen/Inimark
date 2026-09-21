import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWorkspaceState,
  parseWorkspaceState,
  rememberArticleView,
} from "./workspace-state.ts";

describe("library workspace state", () => {
  it("preserves valid synced workspace state", () => {
    const state = parseWorkspaceState(JSON.stringify({
      version: 1,
      selectedBookId: "book-a",
      openArticleId: "article-a",
      collapsedVolumeIdsByBook: { "book-a": ["volume-a"] },
      articleViews: { "article-a": { caret: 42, scrollTop: 120, updatedAt: 10 } },
    }));
    assert.equal(state.selectedBookId, "book-a");
    assert.deepEqual(state.collapsedVolumeIdsByBook, { "book-a": ["volume-a"] });
    assert.deepEqual(state.articleViews["article-a"], {
      caret: 42,
      scrollTop: 120,
      updatedAt: 10,
    });
  });

  it("rejects malformed or future records without blocking a library", () => {
    assert.deepEqual(parseWorkspaceState("not json"), createWorkspaceState());
    assert.deepEqual(parseWorkspaceState('{"version":2}'), createWorkspaceState());
  });

  it("bounds remembered article positions to the most recent entries", () => {
    const state = createWorkspaceState();
    for (let i = 0; i <= 100; i++) {
      rememberArticleView(state, `article-${i}`, { caret: i, scrollTop: i }, i);
    }
    assert.equal(Object.keys(state.articleViews).length, 100);
    assert.equal(state.articleViews["article-0"], undefined);
    assert.equal(state.articleViews["article-100"]?.caret, 100);
  });
});
