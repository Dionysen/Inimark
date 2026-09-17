import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkForUpdate: vi.fn(),
  downloadUpdate: vi.fn(),
  installDownloadedUpdate: vi.fn(),
  relaunchApp: vi.fn(),
  requestUpdatePreflight: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("../src/platform/env.ts", () => ({ isTauri: mocks.isTauri }));
vi.mock("../src/updater.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/updater.ts")>();
  return {
    ...actual,
    checkForUpdate: mocks.checkForUpdate,
    downloadUpdate: mocks.downloadUpdate,
    installDownloadedUpdate: mocks.installDownloadedUpdate,
    relaunchApp: mocks.relaunchApp,
    formatProgressPercent: (downloaded: number, contentLength?: number | null) => {
      if (!contentLength) return "…";
      return String(Math.round((downloaded / contentLength) * 100));
    },
  };
});
vi.mock("../src/update-bridge.ts", () => ({
  requestUpdatePreflight: mocks.requestUpdatePreflight,
}));

import {
  AUTO_UPDATE_INTERVAL_MS,
  createAutoUpdateService,
} from "../src/update/auto-update.ts";

const {
  checkForUpdate,
  downloadUpdate,
  installDownloadedUpdate,
  relaunchApp,
  requestUpdatePreflight,
  isTauri,
} = mocks;

describe("createAutoUpdateService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isTauri.mockReturnValue(true);
    checkForUpdate.mockReset();
    downloadUpdate.mockReset();
    installDownloadedUpdate.mockReset();
    relaunchApp.mockReset();
    requestUpdatePreflight.mockReset();
    requestUpdatePreflight.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("checks on start and every five minutes", async () => {
    checkForUpdate.mockResolvedValue(null);
    const service = createAutoUpdateService();

    service.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(AUTO_UPDATE_INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(checkForUpdate).toHaveBeenCalledTimes(2);

    service.stop();
  });

  test("shows available update after a silent check", async () => {
    checkForUpdate.mockResolvedValue({ version: "1.2.0" });
    const service = createAutoUpdateService();
    const states: string[] = [];
    service.subscribe((state) => states.push(state.phase));

    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(service.getState()).toEqual({
      phase: "available",
      version: "1.2.0",
      progress: 0,
    });
    expect(states).toContain("available");
    service.stop();
  });

  test("startInstall runs preflight, download, install, and relaunch", async () => {
    checkForUpdate.mockResolvedValue({ version: "1.2.0" });
    downloadUpdate.mockImplementation(async (onProgress) => {
      onProgress?.(50, 100);
    });

    const service = createAutoUpdateService();
    service.start();
    await vi.runOnlyPendingTimersAsync();

    await service.startInstall();

    expect(requestUpdatePreflight).toHaveBeenCalledTimes(1);
    expect(downloadUpdate).toHaveBeenCalledTimes(1);
    expect(installDownloadedUpdate).toHaveBeenCalledTimes(1);
    expect(relaunchApp).toHaveBeenCalledTimes(1);
    service.stop();
  });

  test("startInstall aborts when preflight is declined", async () => {
    checkForUpdate.mockResolvedValue({ version: "1.2.0" });
    requestUpdatePreflight.mockResolvedValue(false);

    const service = createAutoUpdateService();
    service.start();
    await vi.runOnlyPendingTimersAsync();

    await service.startInstall();

    expect(downloadUpdate).not.toHaveBeenCalled();
    expect(service.getState().phase).toBe("available");
    service.stop();
  });

  test("does nothing outside Tauri", () => {
    isTauri.mockReturnValue(false);
    const service = createAutoUpdateService();

    service.start();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  test("checkNow returns structured report on error", async () => {
    checkForUpdate.mockRejectedValue(new TypeError("Failed to fetch"));
    const service = createAutoUpdateService();

    const report = await service.checkNow();

    expect(report.outcome).toBe("error");
    expect(report.errorKind).toBe("network");
    service.stop();
  });

  test("checkNow reports available update", async () => {
    checkForUpdate.mockResolvedValue({ version: "2.0.0" });
    const service = createAutoUpdateService();

    const report = await service.checkNow();

    expect(report).toEqual({ outcome: "available", version: "2.0.0" });
    expect(service.getState().phase).toBe("available");
    service.stop();
  });
});
