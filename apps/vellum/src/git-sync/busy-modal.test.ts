import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { openBusyModal, withBusy } from "./busy-modal.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
});

function message(): string {
  return document.querySelector(".vellum-busy-message")?.textContent ?? "";
}

describe("openBusyModal", () => {
  it("shows a modal spinner and replaces an earlier one", () => {
    const first = openBusyModal("Creating repository…");
    assert.equal(document.querySelectorAll(".vellum-busy-overlay").length, 1);
    assert.equal(message(), "Creating repository…");
    assert.equal(document.querySelector(".vellum-busy-spinner")?.getAttribute("aria-hidden"), "true");
    assert.equal(document.querySelector(".vellum-busy-panel")?.getAttribute("aria-modal"), "true");

    const second = openBusyModal("Pushing backup…");
    assert.equal(document.querySelectorAll(".vellum-busy-overlay").length, 1);
    assert.equal(message(), "Pushing backup…");

    first.close();
    assert.equal(message(), "Pushing backup…");
    second.close();
    assert.equal(document.querySelector(".vellum-busy-overlay"), null);
  });

  it("updates the message of the session that is still open", () => {
    const modal = openBusyModal("Creating repository…");
    modal.setMessage("Pushing backup…");
    assert.equal(message(), "Pushing backup…");
    assert.equal(
      document.querySelector(".vellum-busy-panel")?.getAttribute("aria-label"),
      "Pushing backup…",
    );
    modal.close();
  });
});

describe("withBusy", () => {
  it("keeps the spinner up until the work finishes", async () => {
    let seen = "";
    const result = await withBusy("Pulling backup…", async (modal) => {
      seen = message();
      modal.setMessage("Still pulling…");
      return 3;
    });
    assert.equal(result, 3);
    assert.equal(seen, "Pulling backup…");
    assert.equal(document.querySelector(".vellum-busy-overlay"), null);
  });

  it("waits until the spinner has been painted before starting work", async () => {
    const frames: Array<() => void> = [];
    const previous = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(() => callback(0));
      return frames.length;
    }) as typeof requestAnimationFrame;
    try {
      let started = false;
      const pending = withBusy("Pushing backup…", async () => {
        started = true;
      });
      assert.equal(started, false);
      assert.ok(document.querySelector(".vellum-busy-overlay"));
      frames.shift()?.();
      assert.equal(started, false);
      frames.shift()?.();
      await pending;
      assert.equal(started, true);
      assert.equal(document.querySelector(".vellum-busy-overlay"), null);
    } finally {
      globalThis.requestAnimationFrame = previous;
    }
  });

  it("closes the spinner when the work fails", async () => {
    await assert.rejects(
      () => withBusy("Pushing backup…", async () => {
        throw new Error("network");
      }),
      /network/,
    );
    assert.equal(document.querySelector(".vellum-busy-overlay"), null);
  });
});
