// Strategy `auto`, resolved on open: `fixed` in the top layer, for point anchors and
// virtual anchors without a context element, and under a fixed ancestor; else `absolute`
// (an absolute popup follows document scroll for free).

import type { AnchorSource } from "../../env/position"

/** In an open popover, a modal dialog or the fullscreen element. */
function inTopLayer(el: Element): boolean {
  try {
    if (el.closest(":popover-open, :modal")) return true
  } catch {
    // Engines without these pseudo-classes throw on the selector.
  }
  const full = el.ownerDocument.fullscreenElement
  return !!full && (full === el || full.contains(el))
}

/** The anchor or one of its ancestors is `position: fixed`. */
function hasFixedAncestor(el: Element): boolean {
  const view = el.ownerDocument.defaultView
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (view?.getComputedStyle(n).position === "fixed") return true
  }
  return false
}

export function resolveStrategy(
  requested: "auto" | "absolute" | "fixed",
  floating: Element,
  anchor: AnchorSource,
  anchorElement: Element | null,
): "absolute" | "fixed" {
  if (requested !== "auto") return requested
  if (inTopLayer(floating)) return "fixed"
  if (anchor.kind === "point") return "fixed"
  if (anchor.kind === "virtual" && !anchor.get()?.contextElement) return "fixed"
  if (anchorElement && hasFixedAncestor(anchorElement)) return "fixed"
  return "absolute"
}
