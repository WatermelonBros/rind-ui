// Mentions' Svelte parts: a textbox described by its triggers, a combobox while open; "@" filters
// people and inserts a mention the Highlighter paints; Backspace removes it whole; "/" runs an
// action; bind:value; DOM parity with React.
import * as R from "@rind-ui/react"
import { getMentions } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Field from "../../fixtures/mentions/field.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

function setup(root: Record<string, unknown> = {}) {
  const m = mount(Field, { root } as never)
  return { ...m, d: () => getMentions(document.body, { name: "Message" }) }
}

describe("Svelte Mentions", () => {
  it("a described textbox; @ opens the filtered people; Enter inserts a painted mention", async () => {
    const t = setup()
    const box = document.querySelector("textarea") as HTMLTextAreaElement
    expect(box.hasAttribute("aria-expanded")).toBe(false)
    expect(box.getAttribute("aria-describedby")).toBe(
      document.querySelector('[data-part="description"]')?.id,
    )
    await t.d().type("Hi @al")
    expect(await t.d().options()).toEqual(["Alice", "Alan"])
    expect(box.getAttribute("role")).toBe("combobox")
    await t.d().via("keyboard").choose("Alan")
    expect(await t.d().value()).toBe("Hi @Alan ")
    flushSync()
    expect(await t.d().mentions()).toEqual(["@Alan"])
  })

  it("Backspace into a mention removes it whole", async () => {
    const t = setup()
    await t.d().type("Hi @bo")
    await t.d().via("pointer").choose("Bob")
    await t.d().backspace()
    await t.d().backspace()
    expect(await t.d().value()).toBe("Hi ")
  })

  it("/ at the start runs an action", async () => {
    const onSelect = vi.fn()
    const t = setup({ onSelect })
    await t.d().type("/cl")
    await t.d().via("keyboard").choose("Clear")
    expect(onSelect).toHaveBeenCalledWith({ trigger: "/", key: "clear", text: "Clear" })
    expect(await t.d().value()).toBe("")
  })

  it("bind:value follows the text", async () => {
    const onBound = vi.fn()
    const m = mount(Field, { onBound } as never)
    await getMentions(m.host, { name: "Note" }).type("Hey")
    flushSync()
    expect(onBound).toHaveBeenLastCalledWith("Hey")
  })

  it("matches React's DOM", async () => {
    const react = r(
      R.Mentions.Root,
      {
        triggers: [{ char: "@" }],
        defaultValue: "Hi @Bob ",
        defaultMentions: [{ id: "bob", trigger: "@", start: 3, end: 7 }],
      },
      r(R.Mentions.Highlighter, { key: "h" }),
      r(R.Mentions.Textarea, { key: "t", "aria-label": "Message" }),
      r(R.Mentions.Description, { key: "d" }),
    )
    await clientParity(react, Field, { full: false } as never)
  })
})
