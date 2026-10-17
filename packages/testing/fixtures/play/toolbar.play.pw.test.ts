// Ported from the Storybook play function of Toolbar DriverExample.
import { describe, expect, it } from "vitest"
import { getToolbar } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("toolbar")

describe("toolbar stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const toolbar = getToolbar(page, { name: "Formatting" })
    expect(await toolbar.items()).toEqual([
      "Bold",
      "Italic",
      "Underline",
      "Left",
      "Center",
      "Right",
      "Help",
      "Font size",
    ])
    expect(await toolbar.orientation()).toBe("horizontal")
    await toolbar.tabIn()
    expect(await toolbar.focusedItem()).toBe("Bold")
    await toolbar.moveTo("Italic")
    expect(await toolbar.focusedItem()).toBe("Italic")
    await toolbar.tabOut()
    expect(await toolbar.focusedItem()).toBeNull()
    await toolbar.tabIn()
    expect(await toolbar.focusedItem()).toBe("Italic") // focus memory
  })
})
