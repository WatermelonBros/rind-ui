// Ported from the Storybook play function of Toggle DriverExample.
import { describe, expect, it } from "vitest"
import { getToggle } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("toggle-group")

describe("toggle stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("alone-driver-example")
    const toggle = getToggle(page, { name: "Driven" })
    expect(await toggle.isPressed()).toBe(false)
    await toggle.setPressed(true)
    expect(await toggle.isPressed()).toBe(true)
    await toggle.via("keyboard").setPressed(false)
    expect(await toggle.isPressed()).toBe(false)
    await toggle.via("keyboard").activateWithEnter(true)
    expect(await toggle.isPressed()).toBe(true)
  })
})
