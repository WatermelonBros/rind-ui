// Editable's Vue parts: the Preview named by the Label and the value; a press enters edit with
// the text selected; Enter commits and Escape restores, focus back; IME composition; an outside
// press by submitMode; a textarea's Ctrl+Enter; the form reset; markup parity with React.
import * as R from "@rind-ui/react"
import { getEditable } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Editable, RindProvider } from "../index"

function setup(root: Record<string, unknown> = {}, textarea = false) {
  const m = mount(() =>
    h(RindProvider, null, () =>
      h("form", { onSubmit: (e: Event) => e.preventDefault() }, [
        h(Editable.Root, { name: "title", defaultValue: "Hello", ...root }, () => [
          h(Editable.Label, null, () => "Title"),
          h(Editable.Area, null, () => [
            h(Editable.Preview),
            textarea
              ? h(Editable.Input, { asChild: true }, () => h("textarea"))
              : h(Editable.Input),
          ]),
          h(Editable.Control, null, () => [
            h(Editable.EditTrigger, null, () => "Edit"),
            h(Editable.SubmitTrigger, null, () => "Save"),
            h(Editable.CancelTrigger, null, () => "Cancel"),
          ]),
        ]),
        h("button", { type: "button" }, "Elsewhere"),
      ]),
    ),
  )
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

const pointerdown = (el: Element) =>
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }))

describe("Vue Editable", () => {
  it("the Preview is a button named by the Label and the value", async () => {
    const t = setup()
    await nextTick()
    expect(t.preview().tagName).toBe("BUTTON")
    expect(t.preview().getAttribute("aria-labelledby")).toBe(
      `${t.q('[data-part="label"]')?.id} ${t.preview().id}`,
    )
    expect(t.input().hidden).toBe(true)
    expect(await t.d().value()).toBe("Hello")
  })

  it("a press enters edit with the text selected; Enter commits and the focus goes back", async () => {
    const t = setup()
    await nextTick()
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
    await nextTick()
    await t.d().via("keyboard").edit()
    await t.d().type("Draft")
    t.input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    )
    await nextTick()
    expect(await t.d().isEditing()).toBe(true)
    await t.d().via("keyboard").cancel()
    expect(await t.d().value()).toBe("Hello")
  })

  it("an outside press submits by default and cancels with submitMode enter", async () => {
    const both = setup()
    await nextTick()
    await both.d().via("keyboard").edit()
    await both.d().type("Kept")
    pointerdown(both.outside())
    await nextTick()
    expect(await both.d().value()).toBe("Kept")
  })

  it("submitMode enter: an outside press cancels", async () => {
    const t = setup({ submitMode: "enter" })
    await nextTick()
    await t.d().via("keyboard").edit()
    await t.d().type("Dropped")
    pointerdown(t.outside())
    await nextTick()
    expect(await t.d().value()).toBe("Hello")
  })

  it("a textarea commits with Ctrl+Enter; Enter is a newline", async () => {
    const t = setup({}, true)
    await nextTick()
    await t.d().via("keyboard").edit()
    const area = t.input()
    expect(area.tagName).toBe("TEXTAREA")
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    await nextTick()
    expect(await t.d().isEditing()).toBe(true)
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(await t.d().isEditing()).toBe(false)
  })

  it("a form reset restores the default value", async () => {
    const t = setup()
    await nextTick()
    await t.d().via("keyboard").edit()
    await t.d().type("Changed")
    await t.d().via("keyboard").submit()
    ;(t.host.querySelector("form") as HTMLFormElement).reset()
    await vi.waitFor(async () => expect(await t.d().value()).toBe("Hello"))
  })

  it("matches React's markup, server and client", async () => {
    const react = r(
      R.Editable.Root,
      { defaultValue: "Hello" },
      r(R.Editable.Label, { key: "l" }, "Title"),
      r(
        R.Editable.Area,
        { key: "a" },
        r(R.Editable.Preview, { key: "p" }),
        r(R.Editable.Input, { key: "i" }),
      ),
    )
    const vue = () =>
      h(Editable.Root, { defaultValue: "Hello" }, () => [
        h(Editable.Label, null, () => "Title"),
        h(Editable.Area, null, () => [h(Editable.Preview), h(Editable.Input)]),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
