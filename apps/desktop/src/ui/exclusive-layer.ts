/** Stable identity for a floating UI layer (menu, context menu, etc.). */
export type ExclusiveLayerId = object | symbol | string;

type CloseFn = () => void;

const layers = new Map<ExclusiveLayerId, CloseFn>();

/**
 * Claim exclusive visibility: close every other registered layer, then register
 * `close` for this id. Safe to call again for the same id (re-open / reposition).
 */
export function acquireExclusiveLayer(id: ExclusiveLayerId, close: CloseFn): void {
  for (const [otherId, otherClose] of [...layers]) {
    if (otherId === id) continue;
    layers.delete(otherId);
    try {
      otherClose();
    } catch {
      /* ignore teardown errors from sibling layers */
    }
  }
  layers.set(id, close);
}

/** Unregister when a layer closes itself (no-op if already replaced). */
export function releaseExclusiveLayer(id: ExclusiveLayerId): void {
  layers.delete(id);
}

/** Close and clear every registered layer. */
export function dismissExclusiveLayers(): void {
  for (const [id, close] of [...layers]) {
    layers.delete(id);
    try {
      close();
    } catch {
      /* ignore */
    }
  }
}
