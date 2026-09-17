import { describe, expect, test } from "vitest";

import { mergeGraphNodeLayout } from "../src/sidebar/graph-layout.ts";

describe("mergeGraphNodeLayout", () => {
  test("keeps positions for nodes that already exist", () => {
    const previous = new Map([
      ["a", { x: 10, y: 20, vx: 1, vy: 2 }],
      ["b", { x: -5, y: 8, vx: 0, vy: 0 }],
    ]);
    const next = [
      { id: "a", label: "A", path: "a.md", x: 0, y: 0, vx: 0, vy: 0, degree: 1 },
      { id: "b", label: "B", path: "b.md", x: 0, y: 0, vx: 0, vy: 0, degree: 1 },
    ];
    const merged = mergeGraphNodeLayout(next, previous);
    expect(merged[0]).toMatchObject({ id: "a", x: 10, y: 20, vx: 1, vy: 2, degree: 1 });
    expect(merged[1]).toMatchObject({ id: "b", x: -5, y: 8, vx: 0, vy: 0, degree: 1 });
  });

  test("places brand-new nodes near the origin with zero velocity", () => {
    const previous = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    const next = [
      { id: "new", label: "New", path: "new.md", x: 99, y: 99, vx: 9, vy: 9, degree: 0 },
    ];
    const [placed] = mergeGraphNodeLayout(next, previous);
    expect(placed!.vx).toBe(0);
    expect(placed!.vy).toBe(0);
    expect(Math.abs(placed!.x)).toBeLessThanOrEqual(24);
    expect(Math.abs(placed!.y)).toBeLessThanOrEqual(24);
  });
});
