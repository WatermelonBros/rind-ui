// Quirk "firefox-label-focus-unfocused-window": a label's activation always forwards a
// click to its control; focus moves with it only while the window has OS focus (Firefox
// on Linux headless does not move it otherwise). This records both halves.
import { Label } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"

it("a label's activation forwards a click to its control; focus follows with OS focus", async () => {
  render(
    <>
      <Label htmlFor="q">Email</Label>
      <input id="q" type="email" />
    </>,
  )
  const input = document.getElementById("q") as HTMLInputElement // rendered above
  let forwarded = 0
  input.addEventListener("click", () => forwarded++)
  await userEvent.click(document.querySelector("label") as HTMLElement)
  await expect.poll(() => forwarded).toBe(1)
  if (document.hasFocus()) await expect.poll(() => document.activeElement).toBe(input)
})
