import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrollTopToCenter } from "./reveal.ts";

describe("scrollTopToCenter", () => {
  it("leaves the offset when the row is already on the frame center", () => {
    assert.equal(scrollTopToCenter(40, 100, 200, 180, 40), 40);
  });

  it("scrolls down when the row sits below the frame center", () => {
    assert.equal(scrollTopToCenter(0, 0, 200, 160, 40), 80);
  });

  it("scrolls up when the row sits above the frame center", () => {
    assert.equal(scrollTopToCenter(80, 0, 200, 20, 40), 20);
  });
});
