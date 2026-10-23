// css-zoom: the effective CSS `zoom` of an element (its own and its ancestors'). Rects and
// pointer coordinates are viewport pixels, while a length written into an element's style is
// multiplied by its zoom: anything measured that way and written back is divided by this first
// (a page zoomed for a large screen, a zoomed widget). 1 where the platform has no zoom.

/** The element's effective CSS zoom, 1 when unknown. */
export function cssZoom(el: Element): number {
  // currentCSSZoom is not in lib.dom yet; an absent or zero value means no zoom
  return (el as Element & { readonly currentCSSZoom?: number }).currentCSSZoom || 1
}
