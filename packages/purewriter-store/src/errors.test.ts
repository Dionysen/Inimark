import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStoreError } from "./errors.ts";

describe("formatStoreError", () => {
  it("reads Tauri command error objects", () => {
    assert.equal(
      formatStoreError({ code: "locked", message: "library already locked" }),
      "locked: library already locked",
    );
  });

  it("does not yield [object Object]", () => {
    const text = formatStoreError({ code: "io", message: "disk busy" });
    assert.equal(text.includes("[object Object]"), false);
    assert.match(text, /disk busy/);
  });
});
