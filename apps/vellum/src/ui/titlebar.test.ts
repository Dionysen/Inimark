import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";
import { initI18n } from "../i18n/index.ts";
import { mountTitleBar } from "./titlebar.ts";

const happy = new Window({ url: "https://localhost/" });
const doc = happy.document;

Object.assign(globalThis, {
  document: doc,
  window: happy,
  HTMLElement: happy.HTMLElement,
  Element: happy.Element,
  Node: happy.Node,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0) as unknown as number,
});

initI18n("en");

describe("title bar", () => {
  it("pins the immersive action immediately before More", () => {
    let immersive = false;
    let pinned = false;
    const host = doc.createElement("header");
    doc.body.append(host);
    const titleBar = mountTitleBar(host, {
      menuActions: {
        getImmersive: () => immersive,
        onToggleImmersive() {
          immersive = !immersive;
        },
        getImmersivePinned: () => pinned,
        onToggleImmersivePinned() {
          pinned = !pinned;
        },
        canRename: () => false,
        onRename() {},
      },
    });

    const more = host.querySelector<HTMLButtonElement>(".inimark-titlebar-more-btn");
    const pinnedButton = host.querySelector<HTMLButtonElement>(
      ".inimark-titlebar-immersive-btn",
    );
    assert.ok(more);
    assert.ok(pinnedButton);
    assert.equal(pinnedButton.hidden, true);

    more.click();
    const pin = doc.body.querySelector<HTMLButtonElement>(".inimark-menu-item__action");
    assert.ok(pin);
    pin.click();

    assert.equal(pinned, true);
    assert.equal(pinnedButton.hidden, false);
    assert.equal(pinnedButton.nextElementSibling, more);

    pinnedButton.click();
    assert.equal(immersive, true);
    assert.equal(pinnedButton.getAttribute("aria-pressed"), "true");

    titleBar.destroy();
    host.remove();
  });
});
