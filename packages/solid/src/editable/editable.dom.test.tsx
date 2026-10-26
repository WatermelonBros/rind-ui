/** @jsxImportSource solid-js */
// Editable's Solid parts: the Preview names the field and enters edit; Enter submits, Escape
// restores the value at entry; an outside press submits (or cancels by submitMode); the focus
// goes to the Input (selected) and back; a form reset; the triggers.
import type { SubmitMode } from "@rind-ui/core"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Editable } from "./index"

/** Lets mount effects and focus microtasks run (no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

function setup(
  p: { submitMode?: SubmitMode; activationMode?: "dblclick"; textarea?: boolean } = {},
) {
  const values: string[] = []
  const m = mount(() => (
    <form>
      <Editable.Root
        name="title"
        defaultValue="Draft"
        submitMode={p.submitMode}
        activationMode={p.activationMode}
        onValueChange={(v) => values.push(v)}
      >
        <Editable.Label>Title</Editable.Label>
        <Editable.Area>
          <Editable.Preview />
          {p.textarea ? (
            <Editable.Input render={(props) => <textarea {...(props as object)} />} />
          ) : (
            <Editable.Input />
          )}
        </Editable.Area>
        <Editable.Control>
          <Editable.EditTrigger>✎</Editable.EditTrigger>
          <Editable.SubmitTrigger>✓</Editable.SubmitTrigger>
          <Editable.CancelTrigger>✕</Editable.CancelTrigger>
        </Editable.Control>
      </Editable.Root>
      <button type="button">Elsewhere</button>
    </form>
  ))
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
  return { ...m, values, q, input, type, key, editing, hidden }
}

describe("Solid Editable", () => {
  it("shows the value in a Preview button named by the Label", async () => {
    const t = setup()
    await settle()
    const preview = t.q('[data-part="preview"]')
    expect(preview.tagName).toBe("BUTTON")
    expect(preview.textContent).toBe("Draft")
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
    const t = setup()
    await settle()
    t.q('[data-part="preview"]').click()
    await settle()
    expect(t.editing()).toBe(true)
    expect(document.activeElement).toBe(t.input())
    expect(t.input().selectionStart).toBe(0)
    expect(t.input().selectionEnd).toBe(5)
    t.type("Final")
    t.key("Enter")
    await settle()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Final"])
    expect(t.hidden()).toBe("Final")
    expect(document.activeElement).toBe(t.q('[data-part="preview"]'))
  })

  it("Escape restores the value at entry; composition never submits", async () => {
    const t = setup()
    await settle()
    t.q('[data-part="edit-trigger"]').click()
    await settle()
    t.type("Changed")
    t.key("Enter", { isComposing: true })
    expect(t.editing()).toBe(true)
    t.key("Escape")
    await settle()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual([])
    expect(t.q('[data-part="preview"]').textContent).toBe("Draft")
  })

  it("an outside press submits by default, cancels with submitMode enter", async () => {
    for (const [mode, expected] of [
      ["both", ["Outside"]],
      ["enter", []],
    ] as const) {
      const t = setup({ submitMode: mode })
      await settle()
      t.q('[data-part="preview"]').click()
      await settle()
      t.type("Outside")
      const elsewhere = [...t.host.querySelectorAll("button")].find(
        (b) => b.textContent === "Elsewhere",
      ) as HTMLElement
      elsewhere.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
      await settle()
      expect(t.editing()).toBe(false)
      expect(t.values).toEqual(expected)
    }
  })

  it("dblclick mode ignores a single press; a key still enters", async () => {
    const t = setup({ activationMode: "dblclick" })
    await settle()
    const preview = t.q('[data-part="preview"]')
    preview.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }))
    expect(t.editing()).toBe(false)
    preview.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }))
    await settle()
    expect(t.editing()).toBe(true)
    t.key("Escape")
    await settle()
    // Keys always edit (a keyboard click has detail 0).
    preview.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
    await settle()
    expect(t.editing()).toBe(true)
  })

  it("a textarea commits with Ctrl+Enter; Enter is a newline", async () => {
    const t = setup({ textarea: true })
    await settle()
    t.q('[data-part="preview"]').click()
    await settle()
    expect(t.input().tagName).toBe("TEXTAREA")
    t.type("Line")
    t.key("Enter")
    expect(t.editing()).toBe(true)
    t.key("Enter", { ctrlKey: true })
    await settle()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Line"])
  })

  it("keeps keys typed before the focus lands: not selected, not overwritten", async () => {
    const t = setup()
    await settle()
    t.q('[data-part="edit-trigger"]').click()
    t.type("Saved")
    await settle()
    expect(document.activeElement).toBe(t.input())
    expect(t.input().value).toBe("Saved")
    expect(t.input().selectionStart).toBe(t.input().selectionEnd)
  })

  it("the triggers submit and cancel; a form reset restores the default", async () => {
    const t = setup()
    await settle()
    t.q('[data-part="edit-trigger"]').click()
    await settle()
    t.type("Saved")
    t.q('[data-part="submit-trigger"]').click()
    await settle()
    expect(t.values).toEqual(["Saved"])
    t.q('[data-part="edit-trigger"]').click()
    await settle()
    t.type("Discarded")
    t.q('[data-part="cancel-trigger"]').click()
    await settle()
    expect(t.editing()).toBe(false)
    expect(t.values).toEqual(["Saved"])
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(() => expect(t.hidden()).toBe("Draft"))
    expect(t.q('[data-part="preview"]').textContent).toBe("Draft")
  })
})
