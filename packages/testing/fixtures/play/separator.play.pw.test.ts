// Ported from the Storybook play function of Separator DriverExample.
import { describe, expect, it } from "vitest"
import { getSeparator } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("separator")

describe("separator stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const s = getSeparator(page, { within: page.locator('[role="toolbar"]') })
    expect(await s.orientation()).toBe("vertical")
    expect(await s.isDecorative()).toBe(false)
  })
})
