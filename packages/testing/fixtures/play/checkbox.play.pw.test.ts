// Ported from the Storybook play function of Checkbox DriverExample.
import { describe, expect, it } from "vitest"
import { getCheckbox } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("checkbox-group")

describe("checkbox stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("alone-driver-example")
    const box = getCheckbox(page, { name: "Driven" })
    expect(await box.isChecked()).toBe(false)
    await box.check()
    expect(await box.isChecked()).toBe(true)
    await box.via("keyboard").uncheck()
    expect(await box.isChecked()).toBe(false)
    await box.clickLabel()
    expect(await box.isChecked()).toBe(true)
  })
})
