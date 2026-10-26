// Signature Pad (Vue) in a real browser (drawing needs layout): strokes, a second pointer
// ignored, v-model, clear and undo keeping focus and announcing, required and reset.
import { getSignaturePad, recordingAnnouncer } from "@rind-ui/testing"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider, SignaturePad } from "../index"

const style = { width: "300px", height: "120px", display: "block" }
function setup(p: Record<string, unknown> = {}, form = false) {
  const rec = recordingAnnouncer()
  const pad = () =>
    h(SignaturePad.Root, { name: "signature", ...p }, () => [
      h(SignaturePad.Label, null, () => "Signature"),
      h(SignaturePad.Control, { style }, () => [h(SignaturePad.Segment), h(SignaturePad.Guide)]),
      h(SignaturePad.Status),
      h(SignaturePad.UndoTrigger, null, () => "Undo"),
      h(SignaturePad.ClearTrigger, null, () => "Clear"),
    ])
  mount(() =>
    h(RindProvider, { announcer: rec.announcer }, () =>
      form ? h("form", { onSubmit: (e: Event) => e.preventDefault() }, [pad()]) : pad(),
    ),
  )
  return { log: rec.log, d: getSignaturePad(document.body, { label: "Signature" }) }
}
const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLElement

describe("vue signature pad drawing", () => {
  it("a stroke and a dot become the value; v-model reports it", async () => {
    const update = vi.fn()
    const { d } = setup({ "onUpdate:modelValue": update })
    await d.draw()
    await d.tap()
    expect(await d.strokeCount()).toBe(2)
    expect(await d.statusText()).toBe("Signed")
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[1]?.[0].strokes).toHaveLength(2)
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
    await nextTick()
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
