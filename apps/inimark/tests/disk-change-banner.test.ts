import { describe, expect, test } from "vitest";

import { mountDiskChangeBanner } from "../src/ui/disk-change-banner.ts";

describe("disk change banner", () => {
  test("shows reload/keep actions for external modifications", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const banner = mountDiskChangeBanner(host);

    let reloaded = false;
    let kept = false;
    banner.showModified({
      onReload: () => {
        reloaded = true;
      },
      onKeep: () => {
        kept = true;
      },
    });

    expect(banner.isVisible()).toBe(true);
    expect(host.textContent).toContain("This file has been modified externally");

    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((btn) => btn.textContent)).toEqual([
      "Keep my changes",
      "Reload",
    ]);
    buttons[0]!.click();
    expect(kept).toBe(true);
    buttons[1]!.click();
    expect(reloaded).toBe(true);

    banner.hide();
    expect(banner.isVisible()).toBe(false);

    banner.destroy();
    host.remove();
  });

  test("shows close/save-as actions when the file was deleted", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const banner = mountDiskChangeBanner(host);

    let closed = false;
    banner.showDeleted({
      onClose: () => {
        closed = true;
      },
      onSaveAs: () => undefined,
    });

    expect(host.textContent).toContain("This file has been deleted from disk");
    const closeBtn = [...host.querySelectorAll("button")].find((btn) =>
      btn.textContent?.includes("Close"),
    );
    closeBtn!.click();
    expect(closed).toBe(true);

    banner.destroy();
    host.remove();
  });
});
