/**
 * Graph node-label visibility vs camera zoom.
 * Keep the copy in packages/site-render/src/site-graph-runtime.ts in sync.
 */

/**
 * Zoom band where labels go from hidden → opaque for a given text-fade slider.
 * Slider 0–100 (center 50 shown as “0” in settings):
 * - 0: always visible (hide below the camera’s min zoom)
 * - 50: hidden at ≤0.5×, fully opaque from 0.75×
 * - 100: stay hidden until quite zoomed in
 */
function labelFadeBand(textOpacity: number): { hide: number; full: number } {
  const t = Math.max(0, Math.min(1, textOpacity / 100));
  if (t <= 0.5) {
    const u = t * 2;
    return { hide: -1 + 1.5 * u, full: 0.25 + 0.5 * u };
  }
  const u = (t - 0.5) * 2;
  return { hide: 0.5 + 0.75 * u, full: 0.75 + 1.75 * u };
}

/**
 * Label alpha from the text-fade slider and current camera scale.
 * 0 means do not draw the name.
 */
export function graphLabelAlpha(textOpacity: number, scale: number): number {
  if (textOpacity <= 0) return 1;
  const { hide, full } = labelFadeBand(textOpacity);
  if (scale <= hide) return 0;
  if (scale >= full) return 1;
  const u = (scale - hide) / (full - hide);
  return u * u * (3 - 2 * u);
}
