import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import {
  createSyncIndicator,
  reduceSyncIndicator,
  renderSyncButton,
} from "./sync-indicator.ts";

const happy = new Window({ url: "https://localhost/" });
Object.assign(globalThis, {
  document: happy.document,
  HTMLElement: happy.HTMLElement,
});

const labels = {
  pending: "待同步",
  syncing: "正在同步",
  synced: "同步完成",
};

describe("reduceSyncIndicator", () => {
  it("starts pending, becomes synced after a clean push, and returns to pending on edit", () => {
    let state = createSyncIndicator();
    assert.equal(state.phase, "pending");
    state = reduceSyncIndicator(state, { type: "remote", state: "syncing" });
    assert.equal(state.phase, "syncing");
    state = reduceSyncIndicator(state, { type: "remote", state: "ok" });
    assert.equal(state.phase, "synced");
    state = reduceSyncIndicator(state, { type: "edit" });
    assert.equal(state.phase, "pending");
  });

  it("keeps pending when an edit arrives during the push", () => {
    let state = reduceSyncIndicator(createSyncIndicator(), {
      type: "remote",
      state: "syncing",
    });
    state = reduceSyncIndicator(state, { type: "edit" });
    state = reduceSyncIndicator(state, { type: "remote", state: "ok" });
    assert.equal(state.phase, "pending");
    assert.equal(state.editedDuringSync, false);
  });

  it("shows pending with the error after a failed push", () => {
    let state = reduceSyncIndicator(createSyncIndicator(), {
      type: "remote",
      state: "syncing",
    });
    state = reduceSyncIndicator(state, {
      type: "remote",
      state: "error",
      error: "offline",
    });
    assert.equal(state.phase, "pending");
    assert.equal(state.error, "offline");
  });

  it("does not mark synced on boot if the user already edited", () => {
    let state = reduceSyncIndicator(createSyncIndicator(), { type: "edit" });
    state = reduceSyncIndicator(state, { type: "boot-synced" });
    assert.equal(state.phase, "pending");
  });
});

describe("renderSyncButton", () => {
  it("draws a dotted cloud, a spinner, or a plain cloud", () => {
    const button = document.createElement("button");
    renderSyncButton(button, createSyncIndicator(), labels);
    assert.equal(button.querySelector(".vellum-sync-dot") ? true : false, true);
    assert.equal(button.textContent, "待同步");

    renderSyncButton(
      button,
      { phase: "syncing", editedDuringSync: false, dirty: false, error: "" },
      labels,
    );
    assert.equal(button.querySelector(".vellum-sync-spin") ? true : false, true);
    assert.equal(button.querySelector(".vellum-sync-dot"), null);
    assert.equal(button.textContent, "正在同步");

    renderSyncButton(
      button,
      { phase: "synced", editedDuringSync: false, dirty: false, error: "" },
      labels,
    );
    assert.equal(button.querySelector(".vellum-sync-dot"), null);
    assert.equal(button.querySelector(".vellum-sync-spin"), null);
    assert.equal(button.querySelector("path") ? true : false, true);
    assert.equal(button.textContent, "同步完成");
  });
});
