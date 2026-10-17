// Ported from the Storybook play function of CheckboxGroup DriverExample.
import { describe, expect, it } from "vitest"
import { getCheckboxGroup } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("checkbox-group")

describe("checkbox-group stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const group = getCheckboxGroup(page, { name: "Toppings" })
    expect(await group.value()).toEqual([])
    await group.toggle("Ham")
    expect(await group.value()).toEqual(["ham"])
    expect(await group.parentState()).toBe("mixed")
    await group.toggleParent()
    expect(await group.parentState()).toBe("checked")
    await group.via("keyboard").toggleParent()
    expect(await group.value()).toEqual([])
    await group.toggleParent()
    expect(await group.value()).toEqual(["ham"])
  })
})
