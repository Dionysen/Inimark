import assert from "node:assert/strict";
import test from "node:test";
import { classifyUpdateError, formatProgressPercent } from "./updater-status.ts";

test("classifyUpdateError treats timeouts and gateway statuses as network", () => {
  assert.equal(classifyUpdateError(new Error("connection timed out")), "network");
  assert.equal(classifyUpdateError("HTTP status 503"), "network");
  assert.equal(classifyUpdateError(new Error("signature mismatch")), "other");
  assert.equal(classifyUpdateError(""), "other");
});

test("formatProgressPercent rounds against content length", () => {
  assert.equal(formatProgressPercent(0, null), "");
  assert.equal(formatProgressPercent(12, null), "…");
  assert.equal(formatProgressPercent(1, 3), "33%");
  assert.equal(formatProgressPercent(10, 4), "100%");
});
