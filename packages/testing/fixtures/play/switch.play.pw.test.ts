// Ported from the Storybook play function of Switch DriverExample.
import { describe, expect, it } from "vitest"
import { getSwitch } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("switch")

describe("switch stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const sw = getSwitch(page, { name: "Driven" })
    expect(await sw.isChecked()).toBe(false)
    await sw.toggle()
    expect(await sw.isChecked()).toBe(true)
    await sw.via("keyboard").toggle()
    expect(await sw.isChecked()).toBe(false)
    await sw.clickLabel()
    expect(await sw.isChecked()).toBe(true)
  })
})
