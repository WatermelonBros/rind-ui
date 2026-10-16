// Ported from the Storybook play function of SegmentedControl DriverExample.
import { describe, expect, it } from "vitest"
import { getSegmentedControl } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("segmented-control")

describe("segmented-control stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const control = getSegmentedControl(page, { name: "Range" })
    expect(await control.segments()).toEqual(["Day", "Week", "Month"])
    await control.select("Week")
    expect(await control.selected()).toBe("Week")
    expect(await control.formValue()).toEqual([["range", "week"]])
    await control.via("keyboard").select("Month")
    expect(await control.selected()).toBe("Month")
    await control.focusSegment("Day")
    expect(await control.selected()).toBe("Month") // focus alone never selects
  })
})
