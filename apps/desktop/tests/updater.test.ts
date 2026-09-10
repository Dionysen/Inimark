import { describe, expect, test } from "vitest";

import { classifyUpdateError } from "../src/updater.ts";

describe("classifyUpdateError", () => {
  test("treats common fetch and connection failures as network errors", () => {
    expect(classifyUpdateError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyUpdateError(new Error("Network request failed"))).toBe("network");
    expect(classifyUpdateError("connection timed out while fetching update manifest")).toBe(
      "network",
    );
    expect(classifyUpdateError(new Error("error sending request for url: dns error"))).toBe(
      "network",
    );
    expect(classifyUpdateError(new Error("HTTP status client error (503) for url"))).toBe(
      "network",
    );
  });

  test("treats configuration and verification failures as other errors", () => {
    expect(classifyUpdateError(new Error("Could not fetch a valid release JSON from the remote"))).toBe(
      "other",
    );
    expect(classifyUpdateError(new Error("Invalid signature"))).toBe("other");
    expect(classifyUpdateError(new Error("HTTP status client error (404) for url"))).toBe("other");
    expect(classifyUpdateError(new Error("No update available. Check for updates first."))).toBe(
      "other",
    );
  });

  test("defaults unknown errors to other", () => {
    expect(classifyUpdateError(null)).toBe("other");
    expect(classifyUpdateError(undefined)).toBe("other");
    expect(classifyUpdateError({ code: "unknown" })).toBe("other");
  });
});
