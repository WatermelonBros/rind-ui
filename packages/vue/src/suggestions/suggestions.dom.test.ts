// Suggestions' Vue parts: a named group of buttons, presses through the driver, loading keeps
// the focus, the focus back to the prompt, a new set announced only when asked.
import type { SuggestionsSelectDetails } from "@rind-ui/core"
import { getSuggestions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { Suggestions } from "./index"

/** Lets mount effects and the coalesced item report run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  await nextTick()
}

interface Props {
  items: string[]
  loading?: boolean
  announce?: "off" | "polite"
  label?: string
}

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const picked: SuggestionsSelectDetails[] = []
  let prompt: HTMLTextAreaElement | null = null
  const m = mount(
    (p: Props) =>
      h(RindProvider, { announcer: rec.announcer }, () => [
        h("textarea", {
          "aria-label": "Prompt",
          ref: (el: unknown) => {
            prompt = el as HTMLTextAreaElement | null
          },
        }),
        h(
          Suggestions.Root,
          {
            "aria-label": p.label,
            loading: p.loading === true,
            announce: p.announce,
            focusTarget: () => prompt,
            onPick: (d: SuggestionsSelectDetails) => picked.push(d),
          } as never,
          () => [
            ...p.items.map((text) =>
              h(Suggestions.Item, { key: text }, () => [
                h(Suggestions.Label, null, () => text),
                " ",
                h(Suggestions.Description, null, () => "example"),
              ]),
            ),
            h(Suggestions.Item, { key: "off", value: "custom-value", disabled: true }, () =>
              h(Suggestions.Label, null, () => "Off"),
            ),
          ],
        ),
      ]),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const items = () => [...m.host.querySelectorAll<HTMLElement>('[data-part="item"]')]
  return {
    ...m,
    rec,
    picked,
    q,
    items,
    prompt: () => prompt,
    d: () => getSuggestions(document.body, { name: "Suggestions" }),
  }
}

describe("Vue Suggestions", () => {
  it("is a group named Suggestions, of buttons in order", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("group")
    expect(root.getAttribute("aria-label")).toBe("Suggestions")
    expect(root.dataset["count"]).toBe("3")
    expect(t.items().map((i) => i.dataset["index"])).toEqual(["0", "1", "2"])
    expect(await t.d().items()).toEqual(["Summarize example", "Translate example", "Off"])
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("takes the consumer's name", async () => {
    const t = setup({ items: ["A"], label: "Try asking" })
    await settle()
    expect(t.q('[data-part="root"]').getAttribute("aria-label")).toBe("Try asking")
  })

  it("selects with the Label's text or the value; a disabled item does nothing", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    await t.d().via("pointer").pick("Translate")
    expect(t.picked).toEqual([{ value: "Translate", index: 1, key: expect.any(String) }])
    const off = t.items()[2] as HTMLElement
    expect(off.getAttribute("aria-disabled")).toBe("true")
    off.click()
    expect(t.picked).toHaveLength(1)
  })

  it("moves the focus to the prompt after a keyboard press inside", async () => {
    const t = setup({ items: ["Summarize"] })
    await settle()
    await t.d().via("keyboard").pick(0)
    expect(t.picked.map((p) => p.value)).toEqual(["Summarize"])
    expect(document.activeElement).toBe(t.prompt())
  })

  it("keeps the items focusable and inert while loading", async () => {
    const t = setup({ items: ["Summarize"], loading: true })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.dataset["state"]).toBe("loading")
    expect(root.getAttribute("aria-busy")).toBe("true")
    const item = t.items()[0] as HTMLElement
    item.focus()
    item.click()
    expect(document.activeElement).toBe(item)
    expect(t.picked).toEqual([])
    await t.rerender({ loading: false })
    expect(root.dataset["state"]).toBe("ready")
  })

  it("announces a new set only when asked, never on mount", async () => {
    const t = setup({ items: ["A", "B"], announce: "polite" })
    await settle()
    expect(t.rec.log).toEqual([])
    await t.rerender({ items: ["C"] })
    await vi.waitFor(() => expect(t.rec.log.map((a) => a.message)).toEqual(["2 suggestions"]))
  })
})
