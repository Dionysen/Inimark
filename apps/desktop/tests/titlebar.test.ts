import { describe, expect, test } from "vitest";

import { detectPlatform, initPlatform, usesNativeWindowControls } from "../src/platform/platform.ts";
import { mountTitleBar } from "../src/ui/titlebar.ts";

describe("platform detection", () => {
  test("detectPlatform returns a known platform", () => {
    const platform = detectPlatform();
    expect(["macos", "windows", "linux"]).toContain(platform);
  });

  test("initPlatform applies platform class on html", () => {
    const platform = initPlatform();
    expect(document.documentElement.classList.contains(`platform-${platform}`)).toBe(true);
  });

  test("usesNativeWindowControls is true only on macOS", () => {
    document.documentElement.classList.remove("platform-macos", "platform-windows", "platform-linux");
    document.documentElement.classList.add("platform-windows");
    expect(usesNativeWindowControls()).toBe(false);

    document.documentElement.classList.remove("platform-windows");
    document.documentElement.classList.add("platform-macos");
    expect(usesNativeWindowControls()).toBe(true);
  });
});

describe("titlebar", () => {
  test("mounts with deep drag region and document title", () => {
    const host = document.createElement("header");
    const titlebar = mountTitleBar(host, {
      title: "Untitled",
      showWindowControls: false,
    });

    expect(host.getAttribute("data-tauri-drag-region")).toBe("deep");
    expect(host.querySelector(".inimark-titlebar-title")?.textContent).toBe("Untitled");
    expect(host.querySelector(".inimark-titlebar-brand")).toBeNull();

    titlebar.setTitle("Notes.md");
    expect(host.querySelector(".inimark-titlebar-title")?.textContent).toBe("Notes.md");

    titlebar.destroy();
  });

  test("renders sidebar toggle button when configured", () => {
    let open = true;
    const host = document.createElement("header");
    const titlebar = mountTitleBar(host, {
      showWindowControls: false,
      sidebarToggle: {
        open,
        onToggle: () => {
          open = !open;
          titlebar.setSidebarOpen(open);
        },
      },
    });

    const toggle = host.querySelector<HTMLButtonElement>(".inimark-sidebar-toggle-btn");
    expect(toggle).not.toBeNull();
    expect(toggle?.title).toBe("Collapse sidebar");

    toggle?.click();
    expect(open).toBe(false);
    expect(toggle?.title).toBe("Expand sidebar");

    titlebar.destroy();
  });

  test("close-only mode renders a single close button on non-macOS", () => {
    document.documentElement.classList.remove("platform-macos");
    document.documentElement.classList.add("platform-windows");

    const host = document.createElement("header");
    const titlebar = mountTitleBar(host, {
      title: "Settings",
      controlMode: "close-only",
      showWindowControls: true,
    });

    const buttons = host.querySelectorAll(".inimark-titlebar-btn");
    expect(buttons.length).toBe(1);
    expect(buttons[0]?.classList.contains("inimark-titlebar-btn--close")).toBe(true);

    titlebar.destroy();
  });

  test("full mode renders three caption buttons on non-macOS", () => {
    document.documentElement.classList.remove("platform-macos");
    document.documentElement.classList.add("platform-windows");

    const host = document.createElement("header");
    const titlebar = mountTitleBar(host, {
      controlMode: "full",
      showWindowControls: true,
    });

    expect(host.querySelectorAll(".inimark-titlebar-btn").length).toBe(3);
    titlebar.destroy();
  });

  test("hides custom controls on macOS", () => {
    document.documentElement.classList.remove("platform-windows");
    document.documentElement.classList.add("platform-macos");

    const host = document.createElement("header");
    const titlebar = mountTitleBar(host, {
      controlMode: "full",
      showWindowControls: true,
    });

    expect(host.querySelector(".inimark-titlebar-controls")).toBeNull();
    titlebar.destroy();
  });
});
