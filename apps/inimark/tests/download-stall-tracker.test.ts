import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDownloadStallTracker } from "../src/update/download-stall-tracker.ts";

describe("createDownloadStallTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("fires when no bytes increase within stall window", () => {
    const onStall = vi.fn();
    const tracker = createDownloadStallTracker({ stallMs: 60_000, onStall });

    tracker.start();
    vi.advanceTimersByTime(59_999);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  test("resets the timer when download bytes increase", () => {
    const onStall = vi.fn();
    const tracker = createDownloadStallTracker({ stallMs: 60_000, onStall });

    tracker.start();
    vi.advanceTimersByTime(30_000);
    tracker.noteProgress(1024);
    vi.advanceTimersByTime(59_999);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  test("stop prevents a pending stall callback", () => {
    const onStall = vi.fn();
    const tracker = createDownloadStallTracker({ stallMs: 60_000, onStall });

    tracker.start();
    vi.advanceTimersByTime(30_000);
    tracker.stop();
    vi.advanceTimersByTime(60_000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
