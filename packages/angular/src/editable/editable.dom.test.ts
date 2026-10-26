// Editable's Angular parts: the Preview names the field and enters edit; Enter submits, Escape
// restores the value at entry; an outside press submits (or cancels by submitMode); the focus
// goes to the Input (selected) and back; a form reset; the triggers.
import { Component } from "@angular/core"
import type { SubmitMode } from "@rind-ui/core"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Editable } from "./index"

/** The fixture's configuration, for the next mount. */
let current: {
  submitMode: SubmitMode | undefined
  activationMode: "dblclick" | undefined
  textarea: boolean
  changed: (v: string) => void
} = { submitMode: undefined, activationMode: undefined, textarea: false, changed: () => {} }

@Component({
  selector: "rind-f",
  imports: [Editable],
  template: `<form>
    <div
      rindEditableRoot
      name="title"
      defaultValue="Draft"
      [submitMode]="cfg.submitMode"
      [activationMode]="cfg.activationMode"
      (valueChange)="cfg.changed($event)"
    >
      <label rindEditableLabel>Title</label>
      <div rindEditableArea>
        <button rindEditablePreview></button>
        @if (cfg.textarea) {<textarea rindEditableInput></textarea>} @else {<input rindEditableInput />}
      </div>
      <div rindEditableControl>
        <button rindEditableEditTrigger>✎</button>
        <button rindEditableSubmitTrigger>✓</button>
        <button rindEditableCancelTrigger>✕</button>
      </div>
    </div>
    <button type="button" data-testid="elsewhere">Elsewhere</button>
  </form>`,
})
class Tree {
  readonly cfg = current
}

async function setup(
  p: { submitMode?: SubmitMode; activationMode?: "dblclick"; textarea?: boolean } = {},
) {
  const values: string[] = []
  current = {
    submitMode: p.submitMode,
    activationMode: p.activationMode,
    textarea: p.textarea ?? false,
    changed: (v) => values.push(v),
  }
  const m = await mount(Tree)
  const stable = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve()
    await m.rerender({})
  }
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const input = () => q('[data-part="input"]') as HTMLInputElement
  const type = (text: string) => {
    input().value = text
    input().dispatchEvent(new InputEvent("input", { bubbles: true }))
  }
  const key = (k: string, init: KeyboardEventInit = {}) =>
    input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...init }))
  const editing = () => q('[data-part="root"]').dataset["state"] === "edit"
  const hidden = () => (q('[data-part="hidden-input"]') as HTMLInputElement).value
  return { ...m, values, stable, q, input, type, key, editing, hidden }
}

describe("Angular Editable", () => {
  it("shows the value in a Preview button named by the Label", async () => {
    const t = await setup()
    const preview = t.q('[data-part="preview"]')
    expect(preview.textContent?.trim()).toBe("Draft")
    expect(preview.getAttribute("aria-labelledby")).toBe(
      `${t.q('[data-part="label"]').id} ${preview.id}`,
    )
    expect(t.input().hidden).toBe(true)
    expect(t.q('[data-part="submit-trigger"]').hidden).toBe(true)
    expect(t.hidden()).toBe("Draft")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("enters edit on a press, focuses and selects the Input; Enter submits", async () => {
    const t = await setup()
    t.q('[data-part="preview"]').click()
    await t.stable()
    expect(t.editing()).toBe(true)
    expect(document.activeElement).toBe(t.input())
    expect(t.input().selectionEnd).toBe(5)
    t.type("Final")
    t.key("Enter")
    await t.stable()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Final"])
    expect(t.hidden()).toBe("Final")
    expect(document.activeElement).toBe(t.q('[data-part="preview"]'))
  })

  it("Escape restores the value at entry; composition never submits", async () => {
    const t = await setup()
    t.q('[data-part="edit-trigger"]').click()
    await t.stable()
    t.type("Changed")
    t.key("Enter", { isComposing: true })
    expect(t.editing()).toBe(true)
    t.key("Escape")
    await t.stable()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual([])
    expect(t.q('[data-part="preview"]').textContent?.trim()).toBe("Draft")
  })

  it("an outside press submits by default, cancels with submitMode enter", async () => {
    for (const [mode, expected] of [
      ["both", ["Outside"]],
      ["enter", []],
    ] as const) {
      const t = await setup({ submitMode: mode })
      t.q('[data-part="preview"]').click()
      await t.stable()
      t.type("Outside")
      t.q('[data-testid="elsewhere"]').dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }),
      )
      await t.stable()
      expect(t.editing()).toBe(false)
      expect(t.values).toEqual(expected)
    }
  })

  it("dblclick mode ignores a single press", async () => {
    const t = await setup({ activationMode: "dblclick" })
    const preview = t.q('[data-part="preview"]')
    preview.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    await t.stable()
    expect(t.editing()).toBe(false)
    preview.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }))
    await t.stable()
    expect(t.editing()).toBe(true)
    t.key("Escape")
    await t.stable()
    // Keys always edit (a keyboard click has detail 0).
    preview.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
    await t.stable()
    expect(t.editing()).toBe(true)
  })

  it("a textarea commits with Ctrl+Enter; Enter is a newline", async () => {
    const t = await setup({ textarea: true })
    t.q('[data-part="preview"]').click()
    await t.stable()
    expect(t.input().tagName).toBe("TEXTAREA")
    t.type("Line")
    t.key("Enter")
    expect(t.editing()).toBe(true)
    t.key("Enter", { ctrlKey: true })
    await t.stable()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Line"])
  })

  it("keeps keys typed before the focus lands: not selected, not overwritten", async () => {
    const t = await setup()
    t.q('[data-part="edit-trigger"]').click()
    t.type("Saved")
    await t.stable()
    expect(document.activeElement).toBe(t.input())
    expect(t.input().value).toBe("Saved")
    expect(t.input().selectionStart).toBe(t.input().selectionEnd)
  })

  it("the triggers submit; a form reset restores the default", async () => {
    const t = await setup()
    t.q('[data-part="edit-trigger"]').click()
    await t.stable()
    t.type("Saved")
    t.q('[data-part="submit-trigger"]').click()
    await t.stable()
    expect(t.values).toEqual(["Saved"])
    t.q('[data-part="edit-trigger"]').click()
    await t.stable()
    t.type("Discarded")
    t.q('[data-part="cancel-trigger"]').click()
    await t.stable()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Saved"])
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.hidden()).toBe("Draft")
    })
    expect(t.q('[data-part="preview"]').textContent?.trim()).toBe("Draft")
  })
})
