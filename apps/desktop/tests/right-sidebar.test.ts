import { describe, expect, test } from "vitest";

import { mountRightSidebar } from "../src/right-sidebar.ts";

describe("right sidebar tabs", () => {
  test("keeps tabs visible on Windows when collapse control is hidden", () => {
    document.documentElement.classList.remove("platform-macos", "platform-linux");
    document.documentElement.classList.add("platform-windows");

    const host = document.createElement("aside");
    host.style.width = "240px";
    document.body.appendChild(host);

    const sidebar = mountRightSidebar(host);
    const topbar = host.querySelector<HTMLElement>(".inimark-right-sidebar-topbar");
    expect(topbar).not.toBeNull();

    Object.defineProperty(topbar!, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 800,
        right: 1040,
        top: 0,
        bottom: 40,
        width: 240,
        height: 40,
        x: 800,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const tabs = host.querySelectorAll<HTMLButtonElement>(".inimark-sidebar-tab");
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(tab.hidden).toBe(false);
    }

    sidebar.destroy();
    host.remove();
  });
});
