/** Drop targets for vault-relative paths dragged from the file tree (pointer DnD). */

export interface VaultPathDropItem {
  path: string;
  kind: "file" | "directory";
}

export interface VaultPathDropTarget {
  element: HTMLElement;
  onDrop: (items: readonly VaultPathDropItem[]) => void;
}

const DROP_CLASS = "is-vault-path-drop-target";

const targets = new Set<VaultPathDropTarget>();

function pointInElement(element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Topmost registered target under the pointer (last registered wins on overlap). */
export function hitVaultPathDropTarget(
  clientX: number,
  clientY: number,
): VaultPathDropTarget | null {
  let hit: VaultPathDropTarget | null = null;
  for (const target of targets) {
    if (!pointInElement(target.element, clientX, clientY)) continue;
    // Skip hidden / zero-size hosts (e.g. AI panel on the other sidebar).
    const rect = target.element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    hit = target;
  }
  return hit;
}

export function setVaultPathDropHighlight(element: HTMLElement | null): void {
  for (const target of targets) {
    target.element.classList.toggle(DROP_CLASS, target.element === element);
  }
}

export function clearVaultPathDropHighlight(): void {
  setVaultPathDropHighlight(null);
}

/** Register a drop zone; returns unregister. */
export function registerVaultPathDropTarget(
  element: HTMLElement,
  onDrop: (items: readonly VaultPathDropItem[]) => void,
): () => void {
  const target: VaultPathDropTarget = { element, onDrop };
  targets.add(target);
  return () => {
    targets.delete(target);
    element.classList.remove(DROP_CLASS);
  };
}
