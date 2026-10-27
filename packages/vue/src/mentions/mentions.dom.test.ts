// Mentions' Vue parts: a textbox described by its triggers, a combobox while open; "@" filters
// people and inserts a mention the Highlighter paints; Backspace removes it whole; "/" runs an
// action; v-model; markup parity with React.
import type { MentionsQuery } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getMentions } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick, ref, shallowRef } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Mentions, RindProvider } from "../index"

const PEOPLE = ["Alice", "Alan", "Bob"]
const COMMANDS = ["Clear", "Summarise"]
const TRIGGERS = [{ char: "@" }, { char: "/", behavior: "action" as const, startOfInput: true }]

function setup(root: Record<string, unknown> = {}) {
  const query = shallowRef<MentionsQuery | null>(null)
  const m = mount(() =>
    h(RindProvider, null, () => [
      h("label", { for: "msg" }, "Message"),
      h(
        Mentions.Root,
        {
          triggers: TRIGGERS,
          onQueryChange: (q: MentionsQuery | null) => (query.value = q),
          ...root,
        },
        () => [
          h(Mentions.Highlighter),
          h(Mentions.Textarea, { id: "msg" }),
          h(Mentions.Description),
          h(Mentions.Positioner, null, () => [
            h(Mentions.Popup, null, () => [
              h(Mentions.List, null, () =>
                (query.value?.trigger === "/" ? COMMANDS : PEOPLE).map((name) =>
                  h(Mentions.Item, { key: name, value: name.toLowerCase() }, () => [
                    h(Mentions.ItemText, null, () => name),
                  ]),
                ),
              ),
            ]),
          ]),
        ],
      ),
    ]),
  )
  return { ...m, d: () => getMentions(document.body, { name: "Message" }) }
}

describe("Vue Mentions", () => {
  it("a described textbox; @ opens the filtered people; Enter inserts a painted mention", async () => {
    const t = setup()
    await nextTick()
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
    await nextTick()
    expect(await t.d().mentions()).toEqual(["@Alan"])
  })

  it("Backspace into a mention removes it whole", async () => {
    const t = setup()
    await nextTick()
    await t.d().type("Hi @bo")
    await t.d().via("pointer").choose("Bob")
    await t.d().backspace()
    await t.d().backspace()
    expect(await t.d().value()).toBe("Hi ")
  })

  it("/ at the start runs an action", async () => {
    const onSelect = vi.fn()
    const t = setup({ onSelect })
    await nextTick()
    await t.d().type("/cl")
    await t.d().via("keyboard").choose("Clear")
    expect(onSelect).toHaveBeenCalledWith({ trigger: "/", key: "clear", text: "Clear" })
    expect(await t.d().value()).toBe("")
  })

  it("v-model follows the text", async () => {
    const text = ref("")
    const m = mount(() =>
      h(RindProvider, null, () =>
        h(
          Mentions.Root,
          {
            triggers: TRIGGERS,
            modelValue: text.value,
            "onUpdate:modelValue": (v: string) => (text.value = v),
          },
          () => [h(Mentions.Textarea, { "aria-label": "Note" })],
        ),
      ),
    )
    await nextTick()
    await getMentions(m.host, { name: "Note" }).type("Hey")
    expect(text.value).toBe("Hey")
  })

  it("matches React's markup, server and client", async () => {
    const value = "Hi @Bob "
    const mentions = [{ id: "bob", trigger: "@", start: 3, end: 7 }]
    const react = r(
      R.Mentions.Root,
      { triggers: [{ char: "@" }], defaultValue: value, defaultMentions: mentions },
      r(R.Mentions.Highlighter, { key: "h" }),
      r(R.Mentions.Textarea, { key: "t", "aria-label": "Message" }),
      r(R.Mentions.Description, { key: "d" }),
    )
    const vue = () =>
      h(
        Mentions.Root,
        { triggers: [{ char: "@" }], defaultValue: value, defaultMentions: mentions },
        () => [
          h(Mentions.Highlighter),
          h(Mentions.Textarea, { "aria-label": "Message" }),
          h(Mentions.Description),
        ],
      )
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
