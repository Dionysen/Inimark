/**
 * Preserve camera-stable node positions when the link index changes.
 * Used by soft graph refresh after save — avoid re-seeding layout on the UI thread.
 */
export function mergeGraphNodeLayout<
  T extends { id: string; x: number; y: number; vx: number; vy: number },
>(
  next: T[],
  previous: ReadonlyMap<string, Pick<T, "x" | "y" | "vx" | "vy">>,
): T[] {
  return next.map((node) => {
    const existing = previous.get(node.id);
    if (existing) {
      return {
        ...node,
        x: existing.x,
        y: existing.y,
        vx: existing.vx,
        vy: existing.vy,
      };
    }
    return {
      ...node,
      x: (Math.random() - 0.5) * 48,
      y: (Math.random() - 0.5) * 48,
      vx: 0,
      vy: 0,
    };
  });
}
