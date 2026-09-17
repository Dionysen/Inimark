import { describe, expect, test } from "vitest";

import {
  createGraphHoverAmounts,
  edgeHoverKey,
  edgeStrokeAlpha,
  lerpHover,
  mix,
  mixCssColor,
  nodeFillAlpha,
  nodeHoverScale,
  nodeLabelAlpha,
  resetGraphHoverAmounts,
  stepGraphHover,
} from "../src/sidebar/graph-hover.ts";

function settle(
  state: ReturnType<typeof createGraphHoverAmounts>,
  hoverId: string | null,
  adjacency: Map<string, Set<string>>,
  edges: Array<{ source: string; target: string }>,
): void {
  for (let i = 0; i < 48; i++) {
    if (!stepGraphHover(state, hoverId, adjacency, edges)) return;
  }
}

describe("hover blend helpers", () => {
  test("lerpHover eases toward the target and snaps at the end", () => {
    const mid = lerpHover(0, 1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(lerpHover(0.999, 1)).toBe(1);
    expect(lerpHover(0.001, 0)).toBe(0);
  });

  test("idle nodes stay opaque; hover dims the rest", () => {
    expect(nodeFillAlpha(0, 0)).toBe(1);
    expect(nodeFillAlpha(1, 0)).toBeCloseTo(0.22, 10);
    expect(nodeFillAlpha(1, 1)).toBe(1);
    expect(nodeFillAlpha(0.5, 0)).toBeCloseTo(0.61, 5);
  });

  test("edges fade between idle, dim, and hot", () => {
    expect(edgeStrokeAlpha(0, 0)).toBeCloseTo(0.85, 5);
    expect(edgeStrokeAlpha(1, 0)).toBeCloseTo(0.18, 5);
    expect(edgeStrokeAlpha(1, 1)).toBe(1);
  });

  test("hovered node grows smoothly", () => {
    expect(nodeHoverScale(0)).toBe(1);
    expect(nodeHoverScale(1)).toBeCloseTo(1.15, 5);
    expect(nodeHoverScale(0.5)).toBeGreaterThan(1);
    expect(nodeHoverScale(0.5)).toBeLessThan(1.15);
  });

  test("label alpha endpoints match rest / dim / neighbor / hover", () => {
    expect(nodeLabelAlpha(1, 0, 0, 0)).toBe(1);
    expect(nodeLabelAlpha(1, 0, 0, 1)).toBe(0.25);
    expect(nodeLabelAlpha(1, 0, 1, 1)).toBe(1);
    expect(nodeLabelAlpha(0, 1, 1, 1)).toBe(0.92);
    expect(nodeLabelAlpha(1, 1, 1, 1)).toBe(1);
  });

  test("mixCssColor interpolates hex", () => {
    expect(mixCssColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixCssColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixCssColor("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
  });

  test("mix is linear", () => {
    expect(mix(10, 20, 0.25)).toBe(12.5);
  });
});

describe("stepGraphHover", () => {
  const adjacency = new Map<string, Set<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["a", "c"])],
    ["c", new Set(["b"])],
  ]);
  const edges = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
  ];

  test("fades in focus on the hovered node and its neighbor", () => {
    const state = createGraphHoverAmounts();
    const first = stepGraphHover(state, "a", adjacency, edges);
    expect(first).toBe(true);
    expect(state.scene).toBeGreaterThan(0);
    expect(state.scene).toBeLessThan(1);
    expect(state.focus.get("a") ?? 0).toBeGreaterThan(0);
    expect(state.focus.get("b") ?? 0).toBeGreaterThan(0);
    expect(state.focus.has("c")).toBe(false);
    expect(state.edge.get(edgeHoverKey("a", "b")) ?? 0).toBeGreaterThan(0);
    expect(state.edge.has(edgeHoverKey("b", "c"))).toBe(false);

    settle(state, "a", adjacency, edges);
    expect(state.scene).toBe(1);
    expect(state.focus.get("a")).toBe(1);
    expect(state.center.get("a")).toBe(1);
    expect(state.focus.get("b")).toBe(1);
  });

  test("leaving a node fades the scene back to idle", () => {
    const state = createGraphHoverAmounts();
    settle(state, "a", adjacency, edges);
    const leaving = stepGraphHover(state, null, adjacency, edges);
    expect(leaving).toBe(true);
    expect(state.scene).toBeLessThan(1);
    settle(state, null, adjacency, edges);
    expect(state.scene).toBe(0);
    expect(state.focus.size).toBe(0);
    expect(state.center.size).toBe(0);
    expect(state.edge.size).toBe(0);
  });

  test("switching nodes crossfades instead of snapping", () => {
    const state = createGraphHoverAmounts();
    settle(state, "a", adjacency, edges);
    stepGraphHover(state, "c", adjacency, edges);
    const aFocus = state.focus.get("a") ?? 0;
    const cFocus = state.focus.get("c") ?? 0;
    expect(aFocus).toBeGreaterThan(0);
    expect(aFocus).toBeLessThan(1);
    expect(cFocus).toBeGreaterThan(0);
    expect(cFocus).toBeLessThan(1);
    expect(state.center.get("a") ?? 0).toBeGreaterThan(0);
    expect(state.center.get("c") ?? 0).toBeGreaterThan(0);
  });

  test("reset clears amounts immediately", () => {
    const state = createGraphHoverAmounts();
    settle(state, "a", adjacency, edges);
    resetGraphHoverAmounts(state);
    expect(state.scene).toBe(0);
    expect(state.focus.size).toBe(0);
  });
});
