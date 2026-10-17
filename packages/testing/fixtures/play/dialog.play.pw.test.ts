// Ported from the Storybook play function of Dialog DriverExample (skipped in Storybook CI
// after intermittent WebKit timeouts; here it runs in Chromium).
import { describe, expect, it } from "vitest"
import { getDialog } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("dialog")

describe("dialog stories (ported play functions)", () => {
  it("DriverExample", { timeout: 60_000 }, async () => {
    const page = await open("driver-example")
    const dialog = getDialog(page, { name: "Edit profile" })
    expect(await dialog.isOpen()).toBe(false)
    await dialog.open()
    expect(await dialog.isOpen()).toBe(true)
    expect(await dialog.title()).toBe("Edit profile")
    expect(await dialog.description()).toBe("Make changes to your profile here.")
    await dialog.pressEscape()
    expect(await dialog.isOpen()).toBe(false)
    await dialog.via("keyboard").open()
    await dialog.via("keyboard").close()
    expect(await dialog.isOpen()).toBe(false)
  })
})
