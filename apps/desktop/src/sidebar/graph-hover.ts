/**
 * Smooth hover highlight for the relationship graph.
 * Keep the copy in packages/site-render/src/site-graph-runtime.ts in sync.
 */

/** Higher k = more inertia (slower catch-up). ~180ms at 60fps. */
export const GRAPH_HOVER_LERP_K = 0.78;
const SNAP = 0.008;

const NODE_DIM_ALPHA = 0.22;
const EDGE_IDLE_ALPHA = 0.85;
const EDGE_DIM_ALPHA = 0.18;
const EDGE_HOT_ALPHA = 1;
const EDGE_HOT_WIDTH = 1.85;
const NODE_HOVER_SCALE = 1.15;

export interface GraphHoverAmounts {
  /** 0 = idle graph; 1 = hover dim/highlight fully applied. */
  scene: number;
  /** Hovered node + neighbors. */
  focus: Map<string, number>;
  /** The node under the pointer. */
  center: Map<string, number>;
  /** Edges incident to the hovered node. */
  edge: Map<string, number>;
}

export function createGraphHoverAmounts(): GraphHoverAmounts {
  return {
    scene: 0,
    focus: new Map(),
    center: new Map(),
    edge: new Map(),
  };
}

export function resetGraphHoverAmounts(state: GraphHoverAmounts): void {
  state.scene = 0;
  state.focus.clear();
  state.center.clear();
  state.edge.clear();
}

export function edgeHoverKey(source: string, target: string): string {
  return `${source}\0${target}`;
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpHover(current: number, target: number, k = GRAPH_HOVER_LERP_K): number {
  const next = current * k + target * (1 - k);
  if (Math.abs(next - target) < SNAP) return target;
  return next;
}

function parseRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }
  const rgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

export function mixCssColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ca = parseRgb(a);
  const cb = parseRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

export function nodeFillAlpha(scene: number, focus: number): number {
  return mix(1, NODE_DIM_ALPHA, scene * (1 - focus));
}

export function edgeStrokeAlpha(scene: number, hot: number): number {
  return mix(mix(EDGE_IDLE_ALPHA, EDGE_DIM_ALPHA, scene), EDGE_HOT_ALPHA, hot);
}

export function edgeWidthMul(hot: number): number {
  return mix(1, EDGE_HOT_WIDTH, hot);
}

export function nodeHoverScale(center: number): number {
  return mix(1, NODE_HOVER_SCALE, center);
}

/**
 * Label opacity while hover is blending.
 * `center` / `focus` / `scene` are 0–1 amounts (not booleans).
 */
export function nodeLabelAlpha(
  textAlpha: number,
  center: number,
  focus: number,
  scene: number,
): number {
  const dimmed = textAlpha * 0.25;
  const neighbor = textAlpha;
  const hovered = Math.max(textAlpha, 0.92);
  const inScene = mix(dimmed, mix(neighbor, hovered, center), Math.max(focus, center));
  return mix(textAlpha, inScene, scene);
}

function stepMap(
  map: Map<string, number>,
  id: string,
  target: number,
): boolean {
  const current = map.get(id) ?? 0;
  const next = lerpHover(current, target);
  if (next === 0) {
    if (current === 0) return false;
    map.delete(id);
    return true;
  }
  if (next === current) return false;
  map.set(id, next);
  return true;
}

function stepMapTargets(
  map: Map<string, number>,
  targets: Map<string, number>,
): boolean {
  let moving = false;
  const ids = new Set([...map.keys(), ...targets.keys()]);
  for (const id of ids) {
    if (stepMap(map, id, targets.get(id) ?? 0)) moving = true;
  }
  return moving;
}

/**
 * Ease hover amounts toward the current pointer target.
 * Returns true while any channel is still catching up (keep painting).
 */
export function stepGraphHover(
  state: GraphHoverAmounts,
  hoverId: string | null,
  adjacency: Map<string, Set<string>>,
  edges: ReadonlyArray<{ source: string; target: string }>,
): boolean {
  const sceneTarget = hoverId ? 1 : 0;
  const nextScene = lerpHover(state.scene, sceneTarget);
  let moving = nextScene !== state.scene;
  state.scene = nextScene;

  const focusTargets = new Map<string, number>();
  const centerTargets = new Map<string, number>();
  if (hoverId) {
    centerTargets.set(hoverId, 1);
    focusTargets.set(hoverId, 1);
    const neighbors = adjacency.get(hoverId);
    if (neighbors) {
      for (const id of neighbors) focusTargets.set(id, 1);
    }
  }
  if (stepMapTargets(state.focus, focusTargets)) moving = true;
  if (stepMapTargets(state.center, centerTargets)) moving = true;

  const edgeTargets = new Map<string, number>();
  if (hoverId) {
    for (const edge of edges) {
      if (edge.source === hoverId || edge.target === hoverId) {
        edgeTargets.set(edgeHoverKey(edge.source, edge.target), 1);
      }
    }
  }
  if (stepMapTargets(state.edge, edgeTargets)) moving = true;
  return moving;
}
