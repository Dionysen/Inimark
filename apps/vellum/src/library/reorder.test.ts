import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insertionIndex, moveIndex, seamLineY, seamSlot } from "./reorder.ts";

describe("seamSlot", () => {
  const rows = [
    { top: 0, bottom: 40 },
    { top: 48, bottom: 88 },
    { top: 96, bottom: 136 },
  ];

  it("hits the gap between two rows", () => {
    assert.equal(seamSlot(rows, 44), 1);
    assert.equal(seamSlot(rows, 92), 2);
  });

  it("hits the edge band of a seam, not the middle of a row", () => {
    assert.equal(seamSlot(rows, 10), 0);
    assert.equal(seamSlot(rows, 24), null);
    assert.equal(seamSlot(rows, 130), 3);
  });
});

describe("insertionIndex", () => {
  it("maps a seam to the index after the dragged row is removed", () => {
    assert.equal(insertionIndex(0, 3, 4), 2);
    assert.equal(insertionIndex(3, 1, 4), 1);
  });

  it("ignores the seams that already bound the dragged row", () => {
    assert.equal(insertionIndex(1, 1, 4), null);
    assert.equal(insertionIndex(1, 2, 4), null);
  });
});

describe("seamLineY", () => {
  it("places the line on the boundary, including the gap midpoint", () => {
    const rows = [
      { top: 10, bottom: 30 },
      { top: 40, bottom: 60 },
    ];
    assert.equal(seamLineY(rows, 0), 10);
    assert.equal(seamLineY(rows, 1), 35);
    assert.equal(seamLineY(rows, 2), 60);
  });
});

describe("moveIndex", () => {
  it("moves an item forward", () => {
    assert.deepEqual(moveIndex(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    assert.deepEqual(moveIndex(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
  });

  it("returns a copy when the index does not change", () => {
    const src = ["a", "b"];
    const next = moveIndex(src, 1, 1);
    assert.deepEqual(next, src);
    assert.notEqual(next, src);
  });

  it("ignores out-of-range indexes", () => {
    assert.deepEqual(moveIndex(["a", "b"], -1, 0), ["a", "b"]);
    assert.deepEqual(moveIndex(["a", "b"], 0, 4), ["a", "b"]);
  });
});
