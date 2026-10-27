// Suggestions' Svelte parts: a named group of buttons, presses through the driver, loading and
// disabled keep the focus, the focus back to the prompt, a new set announced only when asked,
// and DOM parity with React.
import type { SuggestionsSelectDetails } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getSuggestions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Group from "../../fixtures/suggestions/group.svelte"
import Parity from "../../fixtures/suggestions/parity.svelte"

/** Lets effects and the coalesced item report run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  flushSync()
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
  const m = mount(Group, {
    ...initial,
    provider: { announcer: rec.announcer },
    onSelect: (d: SuggestionsSelectDetails) => picked.push(d),
  } as never)
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const items = () => [...m.host.querySelectorAll<HTMLElement>('[data-part="item"]')]
  const rerender = async (next: Partial<Props>) => {
    m.rerender(next as never)
    await settle()
  }
  return { ...m, rerender, rec, picked, q, items, prompt: () => q("textarea") }
}

describe("Svelte Suggestions", () => {
  it("is a group named Suggestions, of buttons in order", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("group")
    expect(root.getAttribute("aria-label")).toBe("Suggestions")
    expect(root.dataset["count"]).toBe("3")
    expect(t.items().map((i) => i.dataset["index"])).toEqual(["0", "1", "2"])
    const d = getSuggestions(document.body, { name: "Suggestions" })
    expect(await d.items()).toEqual(["Summarize example", "Translate example", "Off"])
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

  it("selects with the Label's text; a disabled item does nothing; keyboard focus goes back", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    const d = getSuggestions(document.body, { name: "Suggestions" })
    await d.via("pointer").pick("Translate")
    expect(t.picked).toEqual([{ value: "Translate", index: 1, key: expect.any(String) }])
    ;(t.items()[2] as HTMLElement).click()
    expect(t.picked).toHaveLength(1)
    await d.via("keyboard").pick(0)
    expect(t.picked.map((p) => p.value)).toEqual(["Translate", "Summarize"])
    expect(document.activeElement).toBe(t.prompt())
  })

  it("keeps the items focusable and inert while loading", async () => {
    const t = setup({ items: ["Summarize"], loading: true })
    await settle()
    const root = t.q('[data-part="root"]')
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

  it("matches React", async () => {
    const react = r(
      R.Suggestions.Root,
      null,
      r(R.Suggestions.Item, { key: "a", value: "a" }, r(R.Suggestions.Label, null, "A")),
    )
    await clientParity(react, Parity, {} as never)
  })
})
