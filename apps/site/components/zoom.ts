/**
 * The page's CSS zoom (globals.css: a big screen sees the site zoomed in steps). Rects and
 * pointer coordinates come in viewport pixels; a length written back into the zoomed page is
 * multiplied by the zoom, so it is divided by it first.
 */
export function zoom(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1
}
