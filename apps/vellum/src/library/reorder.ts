/** Vertical span of a row, in viewport pixels. */
export interface RowSpan {
  top: number;
  bottom: number;
}

/**
 * How far a seam reaches into the neighbouring rows.
 * The middle of a row is not a drop target — only the gap, plus this edge band.
 */
export const SEAM_REACH_PX = 12;

/**
 * Insertion slot `0..rows.length` when `pointerY` is on a seam between rows.
 * `0` is before the first row, `rows.length` is after the last.
 * Returns null when the pointer is on a row body, away from every seam.
 */
export function seamSlot(
  rows: readonly RowSpan[],
  pointerY: number,
  reach = SEAM_REACH_PX,
): number | null {
  if (rows.length === 0) return null;
  let best: { slot: number; dist: number } | null = null;
  for (let slot = 0; slot <= rows.length; slot += 1) {
    const before = slot === 0 ? null : rows[slot - 1]!;
    const after = slot === rows.length ? null : rows[slot]!;
    const seamY = before && after ? (before.bottom + after.top) / 2 : (before?.bottom ?? after!.top);
    const minY = before ? before.bottom - reach : Number.NEGATIVE_INFINITY;
    const maxY = after ? after.top + reach : Number.POSITIVE_INFINITY;
    if (pointerY < minY || pointerY > maxY) continue;
    const dist = Math.abs(pointerY - seamY);
    if (!best || dist < best.dist) best = { slot, dist };
  }
  return best?.slot ?? null;
}

/** Y of the seam line for `slot`, or null when the slot is outside the list. */
export function seamLineY(rows: readonly RowSpan[], slot: number): number | null {
  if (rows.length === 0 || slot < 0 || slot > rows.length) return null;
  if (slot === 0) return rows[0]!.top;
  if (slot === rows.length) return rows[rows.length - 1]!.bottom;
  return (rows[slot - 1]!.bottom + rows[slot]!.top) / 2;
}

/**
 * Index `moveIndex` should use so the dragged row lands in `slot`.
 * Null when that seam is the row's current place (the gap above or below it).
 */
export function insertionIndex(from: number, slot: number, length: number): number | null {
  if (from < 0 || from >= length || slot < 0 || slot > length) return null;
  const to = slot > from ? slot - 1 : slot;
  if (to === from) return null;
  return to;
}

/** Move `from` to `to` within a list. Indexes are positions in the current array. */
export function moveIndex<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return [...items];
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export interface PointerReorderBinding {
  /** Ignore pointerdowns that should not start a reorder (e.g. rename field). */
  row: HTMLElement;
  onStart: () => void;
  onMove: (event: PointerEvent) => void;
  /** `moved` is true only after the pointer crossed the drag threshold. */
  onEnd: (event: PointerEvent, moved: boolean) => void;
}

const DRAG_THRESHOLD_PX = 6;

/**
 * Pointer reorder. A click (no movement past the threshold) still reaches the row's click handler.
 * A drag swallows the following click so expand/open does not fire.
 */
export function bindPointerReorder(binding: PointerReorderBinding): void {
  binding.row.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea")) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) >= DRAG_THRESHOLD_PX
      ) {
        moved = true;
        binding.onStart();
      }
      if (moved) binding.onMove(ev);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) {
        binding.row.addEventListener(
          "click",
          (click) => {
            click.preventDefault();
            click.stopImmediatePropagation();
          },
          { capture: true, once: true },
        );
      }
      binding.onEnd(ev, moved);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}
