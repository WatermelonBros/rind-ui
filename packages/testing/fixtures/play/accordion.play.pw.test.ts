// Ported from the Storybook play function of Accordion DriverExample.
import { describe, expect, it } from "vitest"
import { getAccordion } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("accordion")

describe("accordion stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const accordion = getAccordion(page, { item: "Shipping" })
    expect(await accordion.expanded()).toEqual([])
    await accordion.expand("Shipping")
    expect(await accordion.expanded()).toEqual(["Shipping"])
    await accordion.expand("Returns")
    expect(await accordion.expanded()).toEqual(["Returns"])
    await accordion.collapse("Returns")
    expect(await accordion.expanded()).toEqual([])
  })
})
