// Ported from the Storybook play function of Heading DriverExample.
import { describe, expect, it } from "vitest"
import { getHeading } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("heading")

describe("heading stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    // A bare Heading is level 2 (as in Storybook), so "Profile" is 3.
    const level = (name: string) => getHeading(page, { name }).level()
    expect(await level("Profile")).toBe(3)
    expect(await level("Profile")).toBe((await level("Settings")) + 1)
    expect(await level("Avatar")).toBe((await level("Profile")) + 1)
  })
})
