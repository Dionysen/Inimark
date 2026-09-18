/**
 * Scroll offset that puts the row on the vertical center of a frame
 * (the library sidebar), not merely inside the list’s own viewport.
 */
export function scrollTopToCenter(
  scrollTop: number,
  frameTop: number,
  frameHeight: number,
  rowTop: number,
  rowHeight: number,
): number {
  const delta = rowTop + rowHeight / 2 - (frameTop + frameHeight / 2);
  return scrollTop + delta;
}
