import { describe, expect, test } from "vitest";

import { graphLabelAlpha } from "../src/sidebar/graph-label.ts";

describe("graphLabelAlpha", () => {
  test("slider at 0 keeps labels opaque at any zoom", () => {
    expect(graphLabelAlpha(0, 0.12)).toBe(1);
    expect(graphLabelAlpha(0, 1)).toBe(1);
    expect(graphLabelAlpha(0, 15)).toBe(1);
  });

  test("default hides names when zoomed out and shows them at 1×", () => {
    expect(graphLabelAlpha(50, 0.12)).toBe(0);
    expect(graphLabelAlpha(50, 0.5)).toBe(0);
    expect(graphLabelAlpha(50, 0.625)).toBeCloseTo(0.5, 5);
    expect(graphLabelAlpha(50, 0.75)).toBe(1);
    expect(graphLabelAlpha(50, 1)).toBe(1);
  });

  test("max fade keeps labels hidden until zoomed in", () => {
    expect(graphLabelAlpha(100, 1)).toBe(0);
    expect(graphLabelAlpha(100, 1.25)).toBe(0);
    expect(graphLabelAlpha(100, 1.875)).toBeCloseTo(0.5, 5);
    expect(graphLabelAlpha(100, 2.5)).toBe(1);
  });

  test("alpha is non-decreasing as the camera zooms in", () => {
    const scales = [0.12, 0.3, 0.45, 0.55, 0.65, 0.85, 1, 2, 15];
    for (const opacity of [25, 50, 75, 100]) {
      let prev = -1;
      for (const scale of scales) {
        const alpha = graphLabelAlpha(opacity, scale);
        expect(alpha).toBeGreaterThanOrEqual(prev);
        prev = alpha;
      }
    }
  });

  test("raising the slider hides labels earlier at the same zoom", () => {
    expect(graphLabelAlpha(50, 0.3)).toBeLessThan(graphLabelAlpha(25, 0.3));
    expect(graphLabelAlpha(100, 1)).toBeLessThan(graphLabelAlpha(50, 1));
  });
});
