// The pointer guard tells real movement from a zero-delta move under a resting pointer.
import { expect, it } from "vitest"
import { pointerMoved } from "./pointer-guard"

const move = (x: number, y: number) =>
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }))

it("a pointer resting where a popup opens: its first item move is not movement (BU#4002)", () => {
  pointerMoved(window, 0, 0)
  // The pointer moves on the page (not over an item), then rests at (40, 60).
  move(40, 60)
  // The popup opens under it; the list scrolls: a zero-delta move reaches an item.
  expect(pointerMoved(window, 40, 60)).toBe(false)
  expect(pointerMoved(window, 41, 60)).toBe(true)
})
