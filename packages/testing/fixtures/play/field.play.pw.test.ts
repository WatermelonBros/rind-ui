// Ported from the Storybook play functions of Field: WithDescriptionAndError, Blur, Change,
// MatchMessages.
import { describe, expect, it } from "vitest"
import { getField } from "../../src/index"
import { playHarness } from "./play-harness"

const open = playHarness("field")

describe("field stories (ported play functions)", () => {
  it("WithDescriptionAndError", { timeout: 60_000 }, async () => {
    const page = await open("with-description-and-error")
    const field = getField(page, { label: "Email" })
    await page.getByRole("textbox").pressSequentially("abc")
    await page.getByRole("button", { name: "Send" }).click()
    await expect.poll(() => field.isInvalid()).toBe(true)
    expect(await field.errors()).toHaveLength(1)
  })

  it("Blur", { timeout: 60_000 }, async () => {
    const page = await open("blur")
    await page.getByRole("textbox").pressSequentially("abc")
    await page.keyboard.press("Tab")
    await expect.poll(() => getField(page, { label: "Email" }).isInvalid()).toBe(true)
  })

  it("Change", { timeout: 60_000 }, async () => {
    const page = await open("change")
    await page.getByRole("textbox").pressSequentially("abc")
    await expect.poll(() => getField(page, { label: "Email" }).isInvalid()).toBe(true)
  })

  it("MatchMessages", { timeout: 60_000 }, async () => {
    const page = await open("match-messages")
    await page.getByRole("textbox").pressSequentially("abc")
    await expect
      .poll(() => getField(page, { label: "Email" }).errors())
      .toEqual(["That is not an email address."])
  })
})
