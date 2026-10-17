// Ported from the Storybook play function of Tabs DriverExample.
import { describe, expect, it } from "vitest"
import { getTabs } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("tabs")

describe("tabs stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const tabs = getTabs(page, { name: "Sections" })
    expect(await tabs.tabs()).toEqual(["Account", "Billing", "Team"])
    expect(await tabs.selected()).toBe("Account")
    await tabs.select("Billing")
    expect(await tabs.selected()).toBe("Billing")
    expect(await tabs.panel()).toMatchObject({ text: "Billing settings" })
    await tabs.focusTab("Team")
    expect(await tabs.selected()).toBe("Billing") // focus alone never selects
    await tabs.via("keyboard").select("Team")
    expect(await tabs.selected()).toBe("Team")
  })
})
