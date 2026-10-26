// Swipe tracking with real mouse input: a press that never claims a swipe leaves the click alone.
import { afterEach, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { domEnvironment } from "../env/dom-environment"
import { trackSwipe } from "./swipe"

afterEach(() => {
  document.body.innerHTML = ""
})

it("a mouse click on a checkbox label inside a swipeable element still toggles it", async () => {
  document.body.innerHTML =
    '<div id="sheet" style="height:200px"><label><input type="checkbox"> Only in stock</label></div>'
  const sheet = document.getElementById("sheet") as HTMLElement
  const checkbox = document.querySelector("input") as HTMLInputElement
  const tracker = trackSwipe(domEnvironment(), {
    element: () => sheet,
    directions: () => ["down"],
    prefix: "test",
    onStart: () => {},
    onEnd: () => {},
    onCancel: () => {},
  })
  await userEvent.click(document.querySelector("label") as HTMLLabelElement)
  expect(checkbox.checked).toBe(true)
  tracker.stop()
})
