// Ported from the Storybook play function of TextField DriverExample.
import { describe, expect, it } from "vitest"
import { getTextField } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("text-field")

describe("text-field stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const field = getTextField(page, { name: "Driven" })
    await field.fill("hello")
    expect(await field.value()).toBe("hello")
  })
})
