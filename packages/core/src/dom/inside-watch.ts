// Inside / outside a component, for a selection in progress (calendar spec "Range Cancel And
// Leave"): a press or focus outside the element, and outside any layer whose logical parent is
// inside it, calls `onLeave`. Containment comes from the event's composed path, so it holds
// inside shadow roots (react-spectrum#10330).

import { getLayerStack } from "./layer-stack"

/** Whether an event happened inside `element` or a layer opened from inside it. */
export function eventIsInside(event: Event, element: Element): boolean {
  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  if (path.includes(element)) return true
  const target = (path[0] ?? event.target) as EventTarget | null
  const doc = element.ownerDocument
  return doc ? getLayerStack(doc).isLogicallyInside(target, element) : false
}

/** Calls `onLeave` on the first press or focus outside `element`; returns the stop function. */
export function watchLeave(element: Element, onLeave: () => void): () => void {
  const doc = element.ownerDocument
  if (!doc) return () => {}
  const check = (event: Event) => {
    if (!eventIsInside(event, element)) onLeave()
  }
  doc.addEventListener("pointerdown", check, true)
  doc.addEventListener("focusin", check, true)
  return () => {
    doc.removeEventListener("pointerdown", check, true)
    doc.removeEventListener("focusin", check, true)
  }
}
