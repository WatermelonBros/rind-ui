/** @jsxImportSource solid-js */
// Suggestions' Solid parts: a named group of buttons, presses through the driver, loading and
// disabled keep the focus, the focus back to the prompt, a new set announced only when asked.
import type { SuggestionsSelectDetails } from "@rind-ui/core"
import { getSuggestions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { For } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider, Suggestions } from "../index"

/** Lets mount effects and the coalesced item report run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

interface Props {
  items: string[]
  loading?: boolean
  disabled?: boolean
  announce?: "off" | "polite"
  label?: string
}

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const picked: SuggestionsSelectDetails[] = []
  let prompt: HTMLTextAreaElement | undefined
  const m = mount(
    (p: Props) => (
      <RindProvider announcer={rec.announcer}>
        <textarea aria-label="Prompt" ref={prompt} />
        <Suggestions.Root
          aria-label={p.label}
          loading={p.loading}
          disabled={p.disabled}
          announce={p.announce}
          onSelect={(d) => picked.push(d)}
          focusTarget={() => prompt ?? null}
        >
          <For each={p.items}>
            {(text) => (
              <Suggestions.Item>
                <Suggestions.Label>{text}</Suggestions.Label>{" "}
                <Suggestions.Description>example</Suggestions.Description>
              </Suggestions.Item>
            )}
          </For>
          <Suggestions.Item value="custom-value" disabled>
            <Suggestions.Label>Off</Suggestions.Label>
          </Suggestions.Item>
        </Suggestions.Root>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const items = () => [...m.host.querySelectorAll<HTMLElement>('[data-part="item"]')]
  return { ...m, rec, picked, q, items, prompt: () => prompt }
}

describe("Solid Suggestions", () => {
  it("is a group named Suggestions, of buttons in order", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("group")
    expect(root.getAttribute("aria-label")).toBe("Suggestions")
    expect(root.dataset["count"]).toBe("3")
    expect(t.items().map((i) => i.dataset["index"])).toEqual(["0", "1", "2"])
    expect(t.items()[0]?.getAttribute("type")).toBe("button")
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

  it("selects with the Label's text or the value; a disabled item does nothing", async () => {
    const t = setup({ items: ["Summarize", "Translate"] })
    await settle()
    const d = getSuggestions(document.body, { name: "Suggestions" })
    await d.via("pointer").pick("Translate")
    expect(t.picked).toEqual([{ value: "Translate", index: 1, key: expect.any(String) }])
    const off = t.items()[2] as HTMLElement
    expect(off.getAttribute("aria-disabled")).toBe("true")
    off.click()
    expect(t.picked).toHaveLength(1)
  })

  it("moves the focus to the prompt after a keyboard press inside", async () => {
    const t = setup({ items: ["Summarize"] })
    await settle()
    await getSuggestions(document.body, { name: "Suggestions" }).via("keyboard").pick(0)
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
    expect(item.getAttribute("aria-disabled")).toBe("true")
    item.focus()
    item.click()
    expect(document.activeElement).toBe(item)
    expect(t.picked).toEqual([])
    await t.rerender({ loading: false })
    expect(root.dataset["state"]).toBe("ready")
    expect(item.hasAttribute("aria-disabled")).toBe(false)
  })

  it("announces a new set only when asked, never on mount", async () => {
    const t = setup({ items: ["A", "B"], announce: "polite" })
    await settle()
    expect(t.rec.log).toEqual([])
    await t.rerender({ items: ["C"] })
    await vi.waitFor(() => expect(t.rec.log.map((a) => a.message)).toEqual(["2 suggestions"]))
    const quiet = setup({ items: ["A"] })
    await settle()
    await quiet.rerender({ items: ["B", "C"] })
    await vi.waitFor(() => expect(quiet.q('[data-part="root"]').dataset["count"]).toBe("3"))
    await settle()
    expect(quiet.rec.log).toEqual([])
  })
})
