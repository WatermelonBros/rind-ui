// Editable's Svelte parts: the Preview named by the Label and the value; a press enters edit
// with the text selected; Enter commits and Escape restores, focus back; IME composition; an
// outside press by submitMode; a textarea's Ctrl+Enter; the form reset; DOM parity with React.
import * as R from "@rind-ui/react"
import { getEditable } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Field from "../../fixtures/editable/field.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

function setup(root: Record<string, unknown> = {}, textarea = false) {
  const m = mount(Field, { root, textarea } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    preview: () => q('[data-part="preview"]') as HTMLElement,
    input: () => q('[data-part="input"]') as HTMLInputElement,
    outside: () => m.host.querySelector("form > button") as HTMLElement,
    d: () => getEditable(document.body, { label: "Title" }),
  }
}

const pointerdown = (el: Element) => {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }))
  flushSync()
}

describe("Svelte Editable", () => {
  it("the Preview is a button named by the Label and the value", async () => {
    const t = setup()
    expect(t.preview().tagName).toBe("BUTTON")
    expect(t.preview().getAttribute("aria-labelledby")).toBe(
      `${t.q('[data-part="label"]')?.id} ${t.preview().id}`,
    )
    expect(t.input().hidden).toBe(true)
    expect(await t.d().value()).toBe("Hello")
  })

  it("a press enters edit with the text selected; Enter commits and the focus goes back", async () => {
    const t = setup()
    await t.d().via("pointer").edit()
    await vi.waitFor(() => expect(document.activeElement).toBe(t.input()))
    expect(t.input().selectionEnd).toBe(5)
    await t.d().type("World")
    await t.d().via("keyboard").submit()
    expect(await t.d().value()).toBe("World")
    await vi.waitFor(() => expect(document.activeElement).toBe(t.preview()))
  })

  it("Escape restores the value at entry; a composition's Enter does not commit", async () => {
    const t = setup()
    await t.d().via("keyboard").edit()
    await t.d().type("Draft")
    t.input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    )
    flushSync()
    expect(await t.d().isEditing()).toBe(true)
    await t.d().via("keyboard").cancel()
    expect(await t.d().value()).toBe("Hello")
  })

  it("an outside press submits by default, cancels with submitMode enter", async () => {
    const both = setup()
    await both.d().via("keyboard").edit()
    await both.d().type("Kept")
    pointerdown(both.outside())
    expect(await both.d().value()).toBe("Kept")
  })

  it("submitMode enter: an outside press cancels", async () => {
    const t = setup({ submitMode: "enter" })
    await t.d().via("keyboard").edit()
    await t.d().type("Dropped")
    pointerdown(t.outside())
    expect(await t.d().value()).toBe("Hello")
  })

  it("a textarea commits with Ctrl+Enter; Enter is a newline", async () => {
    const t = setup({}, true)
    await t.d().via("keyboard").edit()
    const area = t.input()
    expect(area.tagName).toBe("TEXTAREA")
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    flushSync()
    expect(await t.d().isEditing()).toBe(true)
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }))
    flushSync()
    expect(await t.d().isEditing()).toBe(false)
  })

  it("a form reset restores the default value", async () => {
    const t = setup()
    await t.d().via("keyboard").edit()
    await t.d().type("Changed")
    await t.d().via("keyboard").submit()
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(async () => expect(await t.d().value()).toBe("Hello"))
  })

  it("matches React", async () => {
    const react = r(
      R.RindProvider,
      null,
      r(
        R.Editable.Root,
        { defaultValue: "Hello" },
        r(R.Editable.Label, { key: "l" }, "Title"),
        r(
          R.Editable.Area,
          { key: "a" },
          // No Input: React writes a controlled input's value as an attribute, Svelte as a property.
          r(R.Editable.Preview, { key: "p" }),
        ),
      ),
    )
    await clientParity(react, Field, { full: false } as never)
  })
})
