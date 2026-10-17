// Ported from the Storybook play function of ToggleGroup DriverExample.
import { describe, expect, it } from "vitest"
import { getToggleGroup } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("toggle-group")

describe("toggle-group stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const group = getToggleGroup(page, { name: "Format" })
    expect(await group.items()).toEqual(["Bold", "Italic", "Underline"])
    expect(await group.pressed()).toEqual([])
    await group.toggle("Italic")
    expect(await group.pressed()).toEqual(["Italic"])
    await group.via("keyboard").toggle("Underline")
    expect(await group.pressed()).toEqual(["Italic", "Underline"])
    await group.focusItem("Bold")
    expect(await group.pressed()).toEqual(["Italic", "Underline"])
  })
})
