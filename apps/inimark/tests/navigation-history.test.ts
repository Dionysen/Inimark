import { describe, expect, test } from "vitest";

import { FileNavigationHistory } from "../src/navigation-history.ts";

describe("FileNavigationHistory", () => {
  test("closeCurrent opens the previous file and drops forward history", () => {
    const history = new FileNavigationHistory();
    history.record("a.md");
    history.record("b.md");
    history.record("c.md");

    expect(history.closeCurrent()).toBe("b.md");
    expect(history.canBack()).toBe(true);
    expect(history.canForward()).toBe(false);
    expect(history.back()).toBe("a.md");
    expect(history.forward()).toBe("b.md");
  });

  test("closeCurrent after navigating back drops the closed branch", () => {
    const history = new FileNavigationHistory();
    history.record("a.md");
    history.record("b.md");
    history.record("c.md");
    expect(history.back()).toBe("b.md");

    expect(history.closeCurrent()).toBe("a.md");
    expect(history.canForward()).toBe(false);
  });

  test("closeCurrent on the only file returns null", () => {
    const history = new FileNavigationHistory();
    history.record("a.md");
    expect(history.closeCurrent()).toBeNull();
    expect(history.canBack()).toBe(false);
  });
});
