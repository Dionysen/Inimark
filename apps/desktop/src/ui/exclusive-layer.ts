/** Stable identity for a floating UI layer (menu, context menu, etc.). */
export type ExclusiveLayerId = object | symbol | string;

type CloseFn = () => void;

export type ExclusiveLayerContains = (node: Node | null) => boolean;

export type ExclusiveLayerOptions = {
  /** Nodes that belong to this layer (menu surface, flyouts, triggers, …). */
  contains?: ExclusiveLayerContains;
};

type LayerEntry = {
  close: CloseFn;
  contains: ExclusiveLayerContains;
};

const layers = new Map<ExclusiveLayerId, LayerEntry>();

let outsideListenerInstalled = false;

function defaultContains(id: ExclusiveLayerId, node: Node | null): boolean {
  return node != null && id instanceof HTMLElement && id.contains(node);
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (layers.size === 0) return;
  const target = event.target as Node | null;
  for (const entry of layers.values()) {
    if (entry.contains(target)) return;
  }
  dismissExclusiveLayers();
}

function ensureOutsideListener(): void {
  if (outsideListenerInstalled) return;
  outsideListenerInstalled = true;
  document.addEventListener("pointerdown", onDocumentPointerDown, true);
}

function removeOutsideListenerIfIdle(): void {
  if (layers.size > 0 || !outsideListenerInstalled) return;
  document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  outsideListenerInstalled = false;
}

/**
 * Claim exclusive visibility: close every other registered layer, then register
 * `close` for this id. Safe to call again for the same id (re-open / reposition).
 */
export function acquireExclusiveLayer(
  id: ExclusiveLayerId,
  close: CloseFn,
  options?: ExclusiveLayerOptions,
): void {
  for (const [otherId, other] of [...layers]) {
    if (otherId === id) continue;
    layers.delete(otherId);
    try {
      other.close();
    } catch {
      /* ignore teardown errors from sibling layers */
    }
  }
  const contains = options?.contains ?? ((node) => defaultContains(id, node));
  layers.set(id, { close, contains });
  ensureOutsideListener();
}

/** Unregister when a layer closes itself (no-op if already replaced). */
export function releaseExclusiveLayer(id: ExclusiveLayerId): void {
  layers.delete(id);
  removeOutsideListenerIfIdle();
}

/** Close and clear every registered layer. */
export function dismissExclusiveLayers(): void {
  for (const [id, entry] of [...layers]) {
    layers.delete(id);
    try {
      entry.close();
    } catch {
      /* ignore */
    }
  }
  removeOutsideListenerIfIdle();
}
