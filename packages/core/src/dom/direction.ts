/**
 * An element's direction: its nearest `[dir]`, else `fallback` (the locale's). Placement and
 * arrow keys both read it, so a menu inside `<div dir="rtl">` expands the way it opens.
 */
export function elementDir(el: Element | null | undefined, fallback: "ltr" | "rtl"): "ltr" | "rtl" {
  const found = el?.closest?.("[dir]")?.getAttribute("dir")
  return found === "rtl" || found === "ltr" ? found : fallback
}

/** The direction arrow keys follow: that of the element handling the key. */
export function keyDir(
  e: { readonly currentTarget: EventTarget | null },
  fallback: "ltr" | "rtl",
): "ltr" | "rtl" {
  // currentTarget of a key event on a part: an Element (or null in a synthetic test).
  return elementDir(e.currentTarget as Element | null, fallback)
}
