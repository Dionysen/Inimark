import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASELINE_FINGERPRINT } from "./types.ts";

describe("baseline fingerprint", () => {
  it("matches Room v27 identity", () => {
    assert.equal(BASELINE_FINGERPRINT.userVersion, 27);
    assert.equal(
      BASELINE_FINGERPRINT.identityHash,
      "af22c7c534a04acc4530d670ac9e43c4",
    );
  });
});
