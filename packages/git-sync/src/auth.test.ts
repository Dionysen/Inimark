import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce.ts";
import { parseOauthCallbackUrl } from "./auth.ts";

describe("pkce", () => {
  it("generates verifier and challenge", async () => {
    const v = generateCodeVerifier();
    assert.equal(v.length, 64);
    const c = await codeChallengeS256(v);
    assert.ok(c.length > 20);
    assert.equal(generateState(16).length, 16);
  });
});

describe("callback parse", () => {
  it("parses custom scheme", () => {
    const p = parseOauthCallbackUrl(
      "vellum://git-oauth/callback?code=ABC&state=XYZ",
    );
    assert.deepEqual(p, { code: "ABC", state: "XYZ" });
  });

  it("rejects missing code", () => {
    assert.equal(
      parseOauthCallbackUrl("vellum://git-oauth/callback?state=XYZ"),
      null,
    );
  });
});
