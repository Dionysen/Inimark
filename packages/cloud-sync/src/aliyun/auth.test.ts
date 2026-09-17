import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { describe, it } from "node:test";

import { endpointsFor, resolveClientId } from "./endpoints.ts";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateState,
} from "./pkce.ts";
import { parseOauthCallbackUrl } from "./auth.ts";

// Node test env may lack Web Crypto on globalThis in older runtimes.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

describe("endpoints", () => {
  it("returns China authorize host by default region", () => {
    assert.match(endpointsFor("cn").authorize, /signin\.aliyun\.com/);
    assert.match(endpointsFor("intl").authorize, /signin\.alibabacloud\.com/);
  });

  it("requires intl client id for international region", () => {
    assert.equal(resolveClientId("cn", "cid-cn"), "cid-cn");
    assert.throws(() => resolveClientId("intl", "cid-cn"), /International/);
    assert.equal(resolveClientId("intl", "cid-cn", "cid-intl"), "cid-intl");
  });
});

describe("pkce", () => {
  it("generates verifier in allowed alphabet and length", () => {
    const v = generateCodeVerifier(64);
    assert.equal(v.length, 64);
    assert.match(v, /^[A-Za-z0-9\-._~]+$/);
  });

  it("matches known S256 challenge vector from RFC 7636", async () => {
    // RFC 7636 appendix B
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await codeChallengeS256(verifier);
    assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("state is shorter than verifier alphabet sample", () => {
    const s = generateState(24);
    assert.equal(s.length, 24);
  });
});

describe("oauth callback parse", () => {
  it("parses custom scheme callback", () => {
    const parsed = parseOauthCallbackUrl(
      "vellum://oauth/callback?code=ABC&state=XYZ",
    );
    assert.deepEqual(parsed, { code: "ABC", state: "XYZ" });
  });

  it("returns null when code missing", () => {
    assert.equal(parseOauthCallbackUrl("vellum://oauth/callback?state=XYZ"), null);
  });
});
