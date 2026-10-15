import { computeAccessibleDescription } from "dom-accessibility-api"
import { expect, it } from "vitest"
import { describedByHint, longPressMessages } from "./long-press"

it("a long-pressable part's description contains the hint from its messages", () => {
  document.body.innerHTML = `<span id="d">Archived</span><span id="h" hidden>${longPressMessages.longPressHint}</span><button aria-describedby="${describedByHint("h", "d")}">Mail</button>`
  const button = document.querySelector("button") as HTMLElement
  expect(computeAccessibleDescription(button)).toBe("Archived Long press for more options")
  document.body.innerHTML = ""
})
