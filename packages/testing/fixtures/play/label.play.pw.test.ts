// Ported from the Storybook play function of Label DriverExample.
import { describe, expect, it } from "vitest"
import { getLabel } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("label")

describe("label stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const label = getLabel(page, { text: "Email" })
    await page.evaluate(() => {
      const w = window as unknown as { __forwarded: number }
      w.__forwarded = 0
      document.querySelector("input")?.addEventListener("click", () => w.__forwarded++)
    })
    await label.click()
    // The label's activation reaches its control (a forwarded click).
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __forwarded: number }).__forwarded))
      .toBe(1)
    await expect.poll(() => label.isControlFocused()).toBe(true)
  })
})
