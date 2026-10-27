/** @jsxImportSource solid-js */
// Signature Pad's Solid parts: anatomy and names, triggers that keep the focus, drawing and
// undo through the driver, two pointers making one stroke, a required pad in a form, reset.
import { getSignaturePad, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Field, RindProvider, SignaturePad, type SignaturePadRootProps } from "../index"

/** Lets mount effects and promise callbacks run (no elapsed time). */
const settle = () => Promise.resolve()
/** Drawing needs layout: jsdom has no boxes, so strokes are driven in real browsers only. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

function setup(props: Partial<SignaturePadRootProps> = {}) {
  const rec = recordingAnnouncer()
  const changes: number[] = []
  const { host } = mount(() => (
    <RindProvider announcer={rec.announcer}>
      <form>
        <SignaturePad.Root
          name="signature"
          onValueChange={(v) => changes.push(v.strokes.length)}
          {...props}
        >
          <SignaturePad.Label>Signature</SignaturePad.Label>
          <SignaturePad.Control style={{ width: "300px", height: "120px" }}>
            <SignaturePad.Segment />
            <SignaturePad.Guide />
          </SignaturePad.Control>
          <SignaturePad.Status />
          <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
          <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
        </SignaturePad.Root>
        <button type="submit">Send</button>
      </form>
    </RindProvider>
  ))
  const q = (sel: string) => host.querySelector(sel) as HTMLElement
  const form = host.querySelector("form") as HTMLFormElement
  return { rec, changes, host, q, form, pad: () => getSignaturePad(document.body) }
}

describe("Solid SignaturePad", () => {
  it("names the Control by the Label and describes it by the Status", async () => {
    const t = setup()
    await settle()
    const control = t.q('[data-part="control"]')
    expect(control.getAttribute("role")).toBe("img")
    expect(control.getAttribute("tabindex")).toBe("-1")
    const label = t.q('[data-part="label"]')
    const status = t.q('[data-part="status"]')
    expect(control.getAttribute("aria-labelledby")).toBe(label.id)
    expect(control.getAttribute("aria-describedby")).toBe(status.id)
    expect(status.textContent).toBe("Not signed")
    expect(t.q('[data-part="segment"]').getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="root"]').dataset["empty"]).toBe("")
    const clear = t.q('[data-part="clear-trigger"]')
    expect(clear.getAttribute("aria-labelledby")).toBe(`${clear.id} ${label.id}`)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("keeps Clear and Undo focusable, and inert, on an empty pad", async () => {
    const t = setup()
    await settle()
    for (const part of ["clear-trigger", "undo-trigger"]) {
      const b = t.q(`[data-part="${part}"]`)
      expect(b.getAttribute("aria-disabled")).toBe("true")
      expect(b.hasAttribute("disabled")).toBe(false)
      b.focus()
      b.click()
      expect(document.activeElement).toBe(b)
    }
    expect(t.changes).toEqual([])
    expect(t.rec.log).toEqual([])
  })

  it.skipIf(jsdom)("draws a stroke, then undoes it", async () => {
    const t = setup()
    await settle()
    const pad = t.pad()
    await pad.draw()
    expect(await pad.strokeCount()).toBe(1)
    expect(await pad.isEmpty()).toBe(false)
    expect(t.q('[data-part="status"]').textContent).toBe("Signed")
    expect((await pad.formValue()).startsWith("data:image/svg+xml,")).toBe(true)
    expect(await pad.undoDisabled()).toBe(false)
    await pad.undo()
    expect(await pad.strokeCount()).toBe(0)
    expect(t.changes).toEqual([1, 0])
    expect(t.rec.log.map((a) => a.message)).toEqual(["Last stroke removed"])
  })

  it.skipIf(jsdom)("makes one stroke from two pointers: the first owns it", async () => {
    const t = setup()
    await settle()
    const pad = t.pad()
    await pad.via("touch").drawWithTwoPointers()
    expect(await pad.strokeCount()).toBe(1)
    expect(t.changes).toEqual([1])
  })

  it("blocks the submit of a required empty pad and focuses the Control", async () => {
    const t = setup({ required: true })
    await settle()
    const input = t.q('[data-part="hidden-input"]') as HTMLInputElement
    expect(input.required).toBe(true)
    expect(t.form.checkValidity()).toBe(false)
    t.form.reportValidity()
    await settle()
    expect(t.q('[data-part="root"]').dataset["invalid"]).toBe("")
    // The browser focuses the invalid input; the pad forwards it to the Control.
    if (!jsdom) {
      await new Promise((r) => requestAnimationFrame(r))
      expect(document.activeElement).toBe(t.q('[data-part="control"]'))
    }
  })

  it("restores the default on a form reset", async () => {
    const stroke = {
      points: [
        { x: 10, y: 10, pressure: 0.5, t: 0 },
        { x: 40, y: 30, pressure: 0.5, t: 16 },
      ],
    }
    const t = setup({ defaultValue: { width: 300, height: 120, strokes: [stroke] } })
    await settle()
    expect(t.q('[data-part="root"]').hasAttribute("data-empty")).toBe(false)
    t.q('[data-part="clear-trigger"]').click()
    expect(t.q('[data-part="root"]').dataset["empty"]).toBe("")
    expect((t.q('[data-part="hidden-input"]') as HTMLInputElement).value).toBe("")
    t.form.reset()
    // The input is re-synced after the browser's own reset (a frame later).
    await vi.waitFor(() =>
      expect((t.q('[data-part="hidden-input"]') as HTMLInputElement).value).not.toBe(""),
    )
    expect(t.q('[data-part="root"]').hasAttribute("data-empty")).toBe(false)
    expect(t.q('[data-part="stroke"]')).not.toBeNull()
    expect((t.q('[data-part="hidden-input"]') as HTMLInputElement).value).not.toBe("")
  })

  it("speaks in the Root's locale", async () => {
    const stroke = { points: [{ x: 10, y: 10, pressure: 0.5, t: 0 }] }
    const t = setup({
      locale: "fr-FR",
      defaultValue: { width: 300, height: 120, strokes: [stroke] },
    })
    await settle()
    t.q('[data-part="clear-trigger"]').click()
    expect(t.rec.log.map((a) => [a.message, a.lang])).toEqual([["Signature cleared", "fr-FR"]])
  })

  it("takes its name, description and required from a Field", async () => {
    const { host } = mount(() => (
      <form>
        <Field.Root name="sig" required>
          <Field.Label>Sign here</Field.Label>
          <SignaturePad.Root>
            <SignaturePad.Control>
              <SignaturePad.Segment />
            </SignaturePad.Control>
            <SignaturePad.Status />
          </SignaturePad.Root>
          <Field.Description>Use your finger</Field.Description>
        </Field.Root>
      </form>
    ))
    await settle()
    const control = host.querySelector('[data-part="control"]') as HTMLElement
    const input = host.querySelector('[data-part="hidden-input"]') as HTMLInputElement
    const label = host.querySelector('[data-scope="field"][data-part="label"]') as HTMLElement
    const description = host.querySelector('[data-scope="field"][data-part="description"]')
    expect(control.getAttribute("aria-labelledby")).toBe(label.id)
    expect(control.getAttribute("aria-describedby")?.split(" ")).toContain(description?.id)
    expect(input.required).toBe(true)
    expect(input.name).toBe("sig")
  })
})
