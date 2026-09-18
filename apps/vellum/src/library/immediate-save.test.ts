import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImmediateSaver } from "./immediate-save.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createImmediateSaver", () => {
  it("starts a save on the first edit", async () => {
    let calls = 0;
    const saver = createImmediateSaver(async () => {
      calls += 1;
    });
    saver.kick();
    await saver.flush();
    assert.equal(calls, 1);
  });

  it("folds edits that arrive during a save into one follow-up", async () => {
    const first = deferred();
    let calls = 0;
    const saver = createImmediateSaver(async () => {
      calls += 1;
      if (calls === 1) await first.promise;
    });
    saver.kick();
    saver.kick();
    saver.kick();
    assert.equal(calls, 1);
    first.resolve();
    await saver.flush();
    assert.equal(calls, 2);
  });

  it("flush waits until the follow-up save finishes", async () => {
    const first = deferred();
    let calls = 0;
    const saver = createImmediateSaver(async () => {
      calls += 1;
      if (calls === 1) {
        await first.promise;
        saver.kick();
      }
    });
    saver.kick();
    const done = saver.flush();
    first.resolve();
    await done;
    assert.equal(calls, 2);
  });
});
