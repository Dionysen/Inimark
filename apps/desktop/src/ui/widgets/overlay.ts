export interface OverlayPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

export function positionBelowOrAbove(
  trigger: DOMRect,
  preferredMax = 280,
  gap = 4,
): OverlayPosition {
  const spaceBelow = window.innerHeight - trigger.bottom - gap - 8;
  const spaceAbove = trigger.top - gap - 8;
  const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(preferredMax, openUp ? spaceAbove : spaceBelow));
  return {
    top: openUp ? trigger.top - gap : trigger.bottom + gap,
    left: trigger.left,
    width: Math.max(trigger.width, 140),
    maxHeight,
    openUp,
  };
}

export function applyOverlayPosition(el: HTMLElement, pos: OverlayPosition): void {
  el.style.left = `${pos.left}px`;
  el.style.width = `${pos.width}px`;
  el.style.maxHeight = `${pos.maxHeight}px`;
  if (pos.openUp) {
    el.style.top = "auto";
    el.style.bottom = `${window.innerHeight - pos.top}px`;
    el.classList.add("is-up");
  } else {
    el.style.bottom = "auto";
    el.style.top = `${pos.top}px`;
    el.classList.remove("is-up");
  }
}

/** Close when clicking outside any of the given roots. */
export function onOutsideClick(
  roots: Array<HTMLElement | null | undefined>,
  onClose: () => void,
): () => void {
  const handler = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (roots.some((root) => root?.contains(target))) return;
    onClose();
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}
