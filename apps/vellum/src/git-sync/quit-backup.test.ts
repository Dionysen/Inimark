import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import {
  createQuitFlow,
  promptCloudBackupFailure,
  type QuitBackupDeps,
} from "./quit-backup.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
  KeyboardEvent: happy.KeyboardEvent,
});

function deps(overrides: Partial<QuitBackupDeps> = {}): QuitBackupDeps & {
  events: string[];
} {
  const events: string[] = [];
  return {
    events,
    flushEdits: async () => {
      events.push("flush");
    },
    cloudReady: async () => true,
    startBackground: async () => {
      events.push("background");
    },
    askRetry: async () => "exit",
    destroy: async () => {
      events.push("destroy");
    },
    ...overrides,
  };
}

describe("createQuitFlow", () => {
  it("starts the background upload, then closes", async () => {
    const d = deps();
    await createQuitFlow(d)();
    assert.deepEqual(d.events, ["flush", "background", "destroy"]);
  });

  it("closes without a background upload when cloud sync is not set up", async () => {
    const d = deps({
      cloudReady: async () => false,
    });
    await createQuitFlow(d)();
    assert.deepEqual(d.events, ["flush", "destroy"]);
  });

  it("retries starting the background process, then closes", async () => {
    let starts = 0;
    const d = deps({
      startBackground: async () => {
        starts += 1;
        d.events.push(`background-${starts}`);
        if (starts === 1) throw new Error("spawn failed");
      },
      askRetry: async (error) => {
        d.events.push(error);
        return "retry";
      },
    });
    await createQuitFlow(d)();
    assert.deepEqual(d.events, [
      "flush",
      "background-1",
      "spawn failed",
      "background-2",
      "destroy",
    ]);
  });

  it("closes when starting the background process fails and the user quits", async () => {
    const d = deps({
      startBackground: async () => {
        d.events.push("background");
        throw { message: "denied" };
      },
    });
    await createQuitFlow(d)();
    assert.deepEqual(d.events, ["flush", "background", "destroy"]);
  });

  it("ignores a second close while the first is still starting", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    let starts = 0;
    const d = deps({
      startBackground: () => {
        starts += 1;
        started();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const quit = createQuitFlow(d);
    const first = quit();
    const second = quit();
    await startedPromise;
    assert.equal(starts, 1);
    release();
    await first;
    await second;
    assert.equal(starts, 1);
    assert.equal(d.events.filter((event) => event === "destroy").length, 1);
  });
});

describe("promptCloudBackupFailure", () => {
  it("resolves retry or exit only from the buttons", async () => {
    const pending = promptCloudBackupFailure({
      title: "Cloud backup failed",
      message: "offline",
      retryLabel: "Retry",
      exitLabel: "Quit anyway",
    });
    const buttons = [...document.querySelectorAll("button")];
    assert.equal(buttons[0]?.textContent, "Quit anyway");
    assert.equal(buttons[1]?.textContent, "Retry");
    buttons[1]?.dispatchEvent(new happy.Event("click"));
    assert.equal(await pending, "retry");
    assert.equal(document.querySelector(".inimark-confirm-dialog"), null);
  });
});
