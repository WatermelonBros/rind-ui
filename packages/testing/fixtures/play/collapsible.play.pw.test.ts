// Ported from the Storybook play function of Collapsible DriverExample.
import { describe, expect, it } from "vitest"
import { getCollapsible } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("collapsible")

describe("collapsible stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const section = getCollapsible(page, { name: "Driven" })
    expect(await section.isOpen()).toBe(false)
    await section.open()
    expect(await section.isOpen()).toBe(true)
    await section.close()
    expect(await section.isOpen()).toBe(false)
  })
})
