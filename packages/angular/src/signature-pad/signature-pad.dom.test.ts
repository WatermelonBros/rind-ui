// Signature Pad's Angular parts: anatomy and names, triggers that keep the focus, drawing and
// undo through the driver, two pointers making one stroke, a required pad in a form, reset.
import { Component } from "@angular/core"
import type { SignatureValue } from "@rind-ui/core"
import { getSignaturePad, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Field } from "../field/field"
import { RindProvider } from "../provider"
import { SignaturePad } from "./signature-pad"

/** Drawing needs layout: jsdom has no boxes, so strokes are driven in real browsers only. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

/** The fixture's configuration, for the next mount. */
let current: {
  required: boolean
  locale?: string
  defaultValue: SignatureValue | undefined
  announcer: unknown
  changed: (v: SignatureValue) => void
} = { required: false, defaultValue: undefined, announcer: null, changed: () => {} }

@Component({
  selector: "rind-f",
  imports: [RindProvider, SignaturePad],
  template: `<ng-container rindProvider [announcer]="$any(cfg.announcer)">
      <form>
        <div
          rindSignaturePadRoot
          name="signature"
          [required]="cfg.required"
          [locale]="cfg.locale"
          [defaultValue]="cfg.defaultValue"
          (valueChange)="cfg.changed($event)"
        >
          <span rindSignaturePadLabel>Signature</span>
          <div rindSignaturePadControl style="width: 300px; height: 120px">
            <svg rindSignaturePadSegment></svg>
            <div rindSignaturePadGuide></div>
          </div>
          <span rindSignaturePadStatus></span>
          <button rindSignaturePadClearTrigger>Clear</button>
          <button rindSignaturePadUndoTrigger>Undo</button>
        </div>
        <button type="submit">Send</button>
      </form>
    </ng-container>`,
})
class Tree {
  readonly cfg = current
}

@Component({
  selector: "rind-ff",
  imports: [Field, SignaturePad],
  template: `<form>
    <div rindFieldRoot name="sig" [required]="true">
      <label rindFieldLabel>Sign here</label>
      <div rindSignaturePadRoot>
        <div rindSignaturePadControl><svg rindSignaturePadSegment></svg></div>
        <span rindSignaturePadStatus></span>
      </div>
      <p rindFieldDescription>Use your finger</p>
    </div>
  </form>`,
})
class InField {}

async function setup(
  p: { required?: boolean; defaultValue?: SignatureValue; locale?: string } = {},
) {
  const rec = recordingAnnouncer()
  const changes: number[] = []
  current = {
    required: p.required ?? false,
    ...(p.locale === undefined ? {} : { locale: p.locale }),
    defaultValue: p.defaultValue,
    announcer: rec.announcer,
    changed: (v) => changes.push(v.strokes.length),
  }
  const m = await mount(Tree)
  // Zoneless: signal writes render on the next stable point.
  const stable = () => m.rerender({})
  await stable()
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const form = m.host.querySelector("form") as HTMLFormElement
  return { rec, changes, host: m.host, q, form, stable, pad: () => getSignaturePad(document.body) }
}

describe("Angular SignaturePad", () => {
  it("names the Control by the Label and describes it by the Status", async () => {
    const t = await setup()
    const control = t.q('[data-part="control"]')
    expect(control.getAttribute("role")).toBe("img")
    expect(control.getAttribute("tabindex")).toBe("-1")
    const label = t.q('[data-part="label"]')
    const status = t.q('[data-part="status"]')
    expect(control.getAttribute("aria-labelledby")).toBe(label.id)
    expect(control.getAttribute("aria-describedby")).toBe(status.id)
    expect(status.textContent?.trim()).toBe("Not signed")
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
    const t = await setup()
    for (const part of ["clear-trigger", "undo-trigger"]) {
      const b = t.q(`[data-part="${part}"]`)
      expect(b.getAttribute("aria-disabled")).toBe("true")
      expect(b.hasAttribute("disabled")).toBe(false)
      b.focus()
      b.click()
      await t.stable()
      expect(document.activeElement).toBe(b)
    }
    expect(t.changes).toEqual([])
    expect(t.rec.log).toEqual([])
  })

  it.skipIf(jsdom)("draws a stroke, then undoes it", async () => {
    const t = await setup()
    const pad = t.pad()
    await pad.draw()
    await t.stable()
    expect(await pad.strokeCount()).toBe(1)
    expect(await pad.isEmpty()).toBe(false)
    expect(t.q('[data-part="status"]').textContent?.trim()).toBe("Signed")
    expect((await pad.formValue()).startsWith("data:image/svg+xml,")).toBe(true)
    await pad.undo()
    await t.stable()
    expect(await pad.strokeCount()).toBe(0)
    expect(t.changes).toEqual([1, 0])
    expect(t.rec.log.map((a) => a.message)).toEqual(["Last stroke removed"])
  })

  it.skipIf(jsdom)("makes one stroke from two pointers: the first owns it", async () => {
    const t = await setup()
    const pad = t.pad()
    await pad.via("touch").drawWithTwoPointers()
    await t.stable()
    expect(await pad.strokeCount()).toBe(1)
    expect(t.changes).toEqual([1])
  })

  it("blocks the submit of a required empty pad and marks it invalid", async () => {
    const t = await setup({ required: true })
    const input = t.q('[data-part="hidden-input"]') as HTMLInputElement
    expect(input.required).toBe(true)
    expect(t.form.checkValidity()).toBe(false)
    t.form.reportValidity()
    await t.stable()
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
    const t = await setup({ defaultValue: { width: 300, height: 120, strokes: [stroke] } })
    expect(t.q('[data-part="root"]').hasAttribute("data-empty")).toBe(false)
    t.q('[data-part="clear-trigger"]').click()
    await t.stable()
    expect(t.q('[data-part="root"]').dataset["empty"]).toBe("")
    expect((t.q('[data-part="hidden-input"]') as HTMLInputElement).value).toBe("")
    t.form.reset()
    await t.stable()
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
    const t = await setup({
      locale: "fr-FR",
      defaultValue: { width: 300, height: 120, strokes: [stroke] },
    })
    t.q('[data-part="clear-trigger"]').click()
    await t.stable()
    expect(t.rec.log.map((a) => [a.message, a.lang])).toEqual([["Signature cleared", "fr-FR"]])
  })

  it("takes its name, description and required from a Field", async () => {
    const m = await mount(InField)
    await m.rerender({})
    const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
    const control = q('[data-part="control"]')
    const input = q('[data-part="hidden-input"]') as HTMLInputElement
    const label = q('[data-scope="field"][data-part="label"]')
    const description = q('[data-scope="field"][data-part="description"]')
    expect(control.getAttribute("aria-labelledby")).toBe(label.id)
    expect(control.getAttribute("aria-describedby")?.split(" ")).toContain(description.id)
    expect(input.required).toBe(true)
    expect(input.name).toBe("sig")
  })
})
