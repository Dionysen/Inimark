import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCAL_BACKUP_INTERVAL_MS, startPeriodicBackup } from "./local-backup.ts";

describe("startPeriodicBackup", () => {
  it("fires on the interval, skips an overlapping tick, and stops", async () => {
    assert.equal(LOCAL_BACKUP_INTERVAL_MS, 5 * 60 * 1000);

    let tick: (() => void) | undefined;
    let interval = 0;
    let calls = 0;
    let release: (() => void) | undefined;
    const stop = startPeriodicBackup(
      () =>
        new Promise<void>((resolve) => {
          calls += 1;
          release = resolve;
        }),
      1000,
      {
        set(callback, ms) {
          interval = ms;
          tick = callback;
          return 1;
        },
        clear() {
          tick = undefined;
        },
      },
    );

    assert.equal(interval, 1000);
    assert.equal(calls, 0);
    tick?.();
    tick?.();
    assert.equal(calls, 1);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    tick?.();
    assert.equal(calls, 2);
    stop();
    assert.equal(tick, undefined);
  });
});
