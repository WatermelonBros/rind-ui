// Ported from the Storybook play function of Button DriverExample.
import { describe, expect, it } from "vitest"
import { getButton } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("button")

describe("button stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    await getButton(page, { name: "Save" }).press()
    expect(await page.getByTestId("count").textContent()).toContain("Pressed: 1")
  })
})
