// Ported from the Storybook play function of Fieldset Danger.
import { describe, expect, it } from "vitest"
import { getFieldset } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("fieldset")

describe("fieldset stories (ported play functions)", () => {
  it("Danger", { timeout: 60_000 }, async () => {
    const page = await open("danger")
    const fieldset = getFieldset(page, { name: "Payment" })
    expect(await fieldset.isInvalid()).toBe(true)
    expect(await fieldset.errors()).toBe("The card was declined.")
  })
})
