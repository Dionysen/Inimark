import { describe, expect, test } from "vitest";

import { mountRightSidebar } from "../src/right-sidebar.ts";

describe("right sidebar tabs", () => {
  test("renders the Vue tab strip with the configured tabs", () => {
    const host = document.createElement("aside");
    document.body.appendChild(host);

    const sidebar = mountRightSidebar(host);
    const topbar = host.querySelector<HTMLElement>(".inimark-right-sidebar-topbar");
    expect(topbar).not.toBeNull();

    const tabs = host.querySelectorAll<HTMLButtonElement>("[role='tab']");
    expect(tabs.length).toBeGreaterThan(0);

    const ids = [...tabs].map((tab) => tab.getAttribute("data-tab-id"));
    for (const expected of ["ai", "outline", "graph"]) {
      expect(ids).toContain(expected);
    }

    sidebar.destroy();
    host.remove();
  });

  test("routes tab selection and collapse toggle through the controller", () => {
    const host = document.createElement("aside");
    document.body.appendChild(host);

    const sidebar = mountRightSidebar(host);

    const activated: string[] = [];
    sidebar.onActivateTab((id) => activated.push(id));

    let toggled = false;
    sidebar.onToggleSidebar(() => {
      toggled = true;
    });

    sidebar.activatePanel("graph");
    expect(activated).toContain("graph");

    const toggle = host.querySelector<HTMLButtonElement>(
      ".inimark-right-sidebar-collapse-btn",
    );
    expect(toggle).not.toBeNull();
    toggle!.click();
    expect(toggled).toBe(true);

    sidebar.destroy();
    host.remove();
  });
});
