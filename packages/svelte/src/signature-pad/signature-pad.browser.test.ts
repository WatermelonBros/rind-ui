// Signature Pad (Svelte) in a real browser (drawing needs layout): strokes, a second pointer
// ignored, clear and undo keeping focus and announcing, required and reset.
import { getSignaturePad, recordingAnnouncer } from "@rind-ui/testing"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import Pad from "../../fixtures/signature-pad/pad.svelte"

function setup(root: Record<string, unknown> = {}, form = false) {
  const rec = recordingAnnouncer()
  mount(Pad, { root, form, provider: { announcer: rec.announcer } } as never)
  return { log: rec.log, d: getSignaturePad(document.body, { label: "Signature" }) }
}
const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLElement

describe("svelte signature pad drawing", () => {
  it("a stroke becomes ink and the value; a tap is a dot", async () => {
    const onValueChange = vi.fn()
    const { d } = setup({ onValueChange })
    await d.draw()
    await d.tap()
    expect(await d.strokeCount()).toBe(2)
    expect(await d.statusText()).toBe("Signed")
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(await d.formValue()).toMatch(/^data:image\/svg\+xml/)
  })

  it("a second finger is ignored; a cancelled stroke is ink", async () => {
    const { d } = setup()
    await d.drawWithTwoPointers()
    await d.cancelStroke()
    expect(await d.strokeCount()).toBe(2)
  })

  it.each([{ disabled: true }, { readonly: true }])("%o draws nothing", async (flags) => {
    const { d } = setup(flags)
    await d.draw()
    expect(await d.strokeCount()).toBe(0)
  })

  it("undo and clear announce and keep focus", async () => {
    const { d, log } = setup()
    await d.draw()
    await d.tap()
    await d.undo()
    expect(await d.strokeCount()).toBe(1)
    const clear = button("Clear")
    clear.focus()
    clear.click()
    flushSync()
    expect(await d.isEmpty()).toBe(true)
    expect(document.activeElement).toBe(clear)
    expect(clear.getAttribute("aria-disabled")).toBe("true")
    expect(log.map((a) => a.message)).toEqual(["Last stroke removed", "Signature cleared"])
  })

  it("required blocks submit while empty; reset empties it", async () => {
    const { d } = setup({ required: true }, true)
    const input = document.querySelector('[data-part="hidden-input"]') as HTMLInputElement
    expect(input.checkValidity()).toBe(false)
    await d.draw()
    expect(input.checkValidity()).toBe(true)
    ;(input.form as HTMLFormElement).reset()
    await vi.waitFor(async () => expect(await d.isEmpty()).toBe(true))
    expect(input.value).toBe("")
  })
})
