// Quirk "firefox-label-focus-unfocused-window": a label's activation always forwards a click to its
// control; Firefox on Linux CI does not move focus with it (even with document.hasFocus()),
// so focus is checked outside Firefox only. This records both halves.
import { Label } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { userEvent } from "vitest/browser"

it("a label's activation forwards a click to its control; focus follows outside Firefox", async () => {
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
  if (!navigator.userAgent.includes("Firefox")) {
    await expect.poll(() => document.activeElement).toBe(input)
  }
})
