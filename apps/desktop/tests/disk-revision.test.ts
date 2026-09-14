import { describe, expect, test } from "vitest";

import {
  buildDiskRevision,
  classifyDiskProbe,
  fingerprintContent,
} from "../src/workspace/disk-revision.ts";

describe("disk-revision", () => {
  test("fingerprint is stable for the same content", () => {
    expect(fingerprintContent("hello\n")).toBe(fingerprintContent("hello\n"));
    expect(fingerprintContent("hello\n")).not.toBe(fingerprintContent("hello!\n"));
  });

  test("unchanged when mtime and size still match baseline", () => {
    const baseline = buildDiskRevision("body", { mtimeMs: 100, size: 4 });
    expect(
      classifyDiskProbe({
        baseline,
        dismissedFingerprint: null,
        exists: true,
        meta: { mtimeMs: 100, size: 4 },
        text: "body",
      }),
    ).toEqual({ status: "unchanged" });
  });

  test("same-content when only metadata changed", () => {
    const baseline = buildDiskRevision("body", { mtimeMs: 100, size: 4 });
    const result = classifyDiskProbe({
      baseline,
      dismissedFingerprint: null,
      exists: true,
      meta: { mtimeMs: 200, size: 4 },
      text: "body",
    });
    expect(result.status).toBe("same-content");
    if (result.status === "same-content") {
      expect(result.revision.fingerprint).toBe(baseline.fingerprint);
      expect(result.revision.mtimeMs).toBe(200);
    }
  });

  test("modified when content diverges", () => {
    const baseline = buildDiskRevision("old", { mtimeMs: 100, size: 3 });
    const result = classifyDiskProbe({
      baseline,
      dismissedFingerprint: null,
      exists: true,
      meta: { mtimeMs: 200, size: 3 },
      text: "new",
      respectDismissal: true,
    });
    expect(result.status).toBe("modified");
    if (result.status === "modified") {
      expect(result.text).toBe("new");
    }
  });

  test("respectDismissal suppresses banner for a kept revision", () => {
    const baseline = buildDiskRevision("mine", { mtimeMs: 100, size: 4 });
    const external = buildDiskRevision("theirs", { mtimeMs: 200, size: 6 });
    expect(
      classifyDiskProbe({
        baseline,
        dismissedFingerprint: external.fingerprint,
        exists: true,
        meta: { mtimeMs: 200, size: 6 },
        text: "theirs",
        respectDismissal: true,
      }),
    ).toEqual({ status: "dismissed" });

    const forSave = classifyDiskProbe({
      baseline,
      dismissedFingerprint: external.fingerprint,
      exists: true,
      meta: { mtimeMs: 200, size: 6 },
      text: "theirs",
      respectDismissal: false,
    });
    expect(forSave.status).toBe("modified");
  });

  test("deleted when the file no longer exists", () => {
    const baseline = buildDiskRevision("body", { mtimeMs: 100, size: 4 });
    expect(
      classifyDiskProbe({
        baseline,
        dismissedFingerprint: null,
        exists: false,
      }),
    ).toEqual({ status: "deleted" });
  });
});
