// Ported from the Storybook play function of RadioGroup DriverExample.
import { describe, expect, it } from "vitest"
import { getRadioGroup } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("radio-group")

describe("radio-group stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const group = getRadioGroup(page, { name: "Size" })
    expect(await group.radios()).toEqual(["Small", "Medium", "Large"])
    expect(await group.checked()).toBeNull()
    await group.check("Medium")
    expect(await group.checked()).toBe("Medium")
    expect(await group.formValue()).toEqual([["size", "medium"]])
    await group.via("keyboard").check("Large")
    expect(await group.checked()).toBe("Large")
    await group.focusRadio("Small")
    expect(await group.checked()).toBe("Large")
  })
})
