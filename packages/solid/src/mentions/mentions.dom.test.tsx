/** @jsxImportSource solid-js */
// Mentions' Solid parts through its driver: a textbox described by its triggers that becomes a
// combobox while its list is open; "@" filters people and inserts a mention, which the
// Highlighter paints and Backspace removes whole; Escape keeps the list closed while typing on;
// "/" runs an action (the query removed, onSelect called). In a browser: the list opens at the
// trigger character, not at the textarea's corner.
import type { MentionsQuery } from "@rind-ui/core"
import { getMentions } from "@rind-ui/testing"
import axe from "axe-core"
import { createSignal, For } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { Mentions, type MentionsRootProps } from "./index"

/** Lets mount effects and registrations run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}
/** Placement needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

const PEOPLE = ["Alice", "Alan", "Bob"]
const COMMANDS = ["Clear", "Summarise"]

function setup(props: Partial<MentionsRootProps> = {}) {
  const m = mount(() => {
    const [query, setQuery] = createSignal<MentionsQuery | null>(null)
    const list = () => (query()?.trigger === "/" ? COMMANDS : PEOPLE)
    return (
      <RindProvider>
        <Mentions.Root
          triggers={[{ char: "@" }, { char: "/", behavior: "action", startOfInput: true }]}
          onQueryChange={setQuery}
          {...props}
        >
          <label for="msg">Message</label>
          <Mentions.Highlighter />
          <Mentions.Textarea id="msg" />
          <Mentions.Description />
          <Mentions.Positioner>
            <Mentions.Popup>
              <Mentions.List>
                <For each={list()}>
                  {(name) => (
                    <Mentions.Item value={name.toLowerCase()}>
                      <Mentions.ItemText>{name}</Mentions.ItemText>
                    </Mentions.Item>
                  )}
                </For>
              </Mentions.List>
              <Mentions.Empty>No match</Mentions.Empty>
            </Mentions.Popup>
          </Mentions.Positioner>
        </Mentions.Root>
      </RindProvider>
    )
  })
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return { ...m, q, d: () => getMentions(document.body, { name: "Message" }) }
}

describe("Solid Mentions", () => {
  it("a textbox described by its triggers; no combobox state while closed", async () => {
    const t = setup()
    await settle()
    const box = t.q('[data-part="textarea"]') as HTMLElement
    expect(box.hasAttribute("aria-expanded")).toBe(false)
    expect(box.getAttribute("aria-describedby")).toBe(t.q('[data-part="description"]')?.id)
    expect(t.q('[data-part="description"]')?.textContent).toBe("Type @ or / to insert a mention")
    expect(t.q('[data-part="highlighter"]')?.getAttribute("aria-hidden")).toBe("true")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("@ opens the people filtered by the query; Enter inserts a mention, painted", async () => {
    const onMentionsChange = vi.fn()
    const t = setup({ onMentionsChange })
    await settle()
    const d = t.d()
    await d.type("Hi @al")
    expect(await d.isOpen()).toBe(true)
    expect(await d.trigger()).toBe("@")
    expect(await d.options()).toEqual(["Alice", "Alan"])
    expect(t.q('[data-part="textarea"]')?.getAttribute("role")).toBe("combobox")
    expect(t.q('[data-part="textarea"]')?.getAttribute("aria-expanded")).toBe("true")
    await d.via("keyboard").choose("Alan")
    expect(await d.value()).toBe("Hi @Alan ")
    expect(await d.mentions()).toEqual(["@Alan"])
    expect(onMentionsChange.mock.lastCall?.[0]).toEqual([
      { id: "alan", trigger: "@", start: 3, end: 8 },
    ])
  })

  it("Backspace into a mention removes it whole", async () => {
    const t = setup()
    await settle()
    const d = t.d()
    await d.type("Hi @bo")
    await d.via("pointer").choose("Bob")
    expect(await d.value()).toBe("Hi @Bob ")
    await d.backspace()
    await d.backspace()
    expect(await d.value()).toBe("Hi ")
    expect(await d.mentions()).toEqual([])
  })

  it("Escape closes the list and it stays closed while typing on", async () => {
    const t = setup()
    await settle()
    const d = t.d()
    await d.type("@a")
    await d.pressEscape()
    await d.type("l")
    expect(await d.isOpen()).toBe(false)
    await d.type(" @b")
    expect(await d.isOpen()).toBe(true)
  })

  it("/ at the start runs an action: the query is removed and onSelect called", async () => {
    const onSelect = vi.fn()
    const t = setup({ onSelect })
    await settle()
    const d = t.d()
    await d.type("/cl")
    expect(await d.options()).toEqual(["Clear"])
    await d.via("keyboard").choose("Clear")
    expect(onSelect).toHaveBeenCalledWith({ trigger: "/", key: "clear", text: "Clear" })
    expect(await d.value()).toBe("")
  })

  it("a default value with mentions is painted by the Highlighter", async () => {
    const t = setup({
      defaultValue: "Hi @Bob ",
      defaultMentions: [{ id: "bob", trigger: "@", start: 3, end: 7 }],
    })
    await settle()
    expect(t.q('[data-part="mention"]')?.textContent).toBe("@Bob")
  })

  it.skipIf(jsdom)("the list opens under the trigger character", async () => {
    mount(() => (
      <RindProvider>
        <Mentions.Root triggers={[{ char: "@" }]}>
          <Mentions.Textarea
            aria-label="Placed"
            style={{
              width: "400px",
              height: "80px",
              font: "16px monospace",
              padding: "0",
              border: "0",
            }}
          />
          <Mentions.Positioner>
            <Mentions.Popup>
              <Mentions.List>
                <Mentions.Item value="ann">Ann</Mentions.Item>
              </Mentions.List>
            </Mentions.Popup>
          </Mentions.Positioner>
        </Mentions.Root>
      </RindProvider>
    ))
    await settle()
    const d = getMentions(document.body, { name: "Placed" })
    await d.type("xxxxxxxxxxxxxxxxxxxx @a")
    const textarea = document.querySelector('[aria-label="Placed"]') as HTMLElement
    const root = textarea.closest('[data-part="root"]') as HTMLElement
    await vi.waitFor(() => {
      const positioner = document.querySelector(
        `[data-part="positioner"][data-instance="${root.dataset["instance"]}"]`,
      ) as HTMLElement
      const tr = textarea.getBoundingClientRect()
      const p = positioner.getBoundingClientRect()
      // 21 monospace characters in: well right of the textarea's left edge.
      expect(p.left - tr.left).toBeGreaterThan(150)
      expect(p.top).toBeGreaterThan(tr.top)
    })
  })
})
