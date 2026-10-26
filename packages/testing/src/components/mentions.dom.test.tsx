// Mentions (React) through its driver (spec mentions): a textbox described by its triggers that
// becomes a combobox while its list is open; "@" filters people and inserts a mention, which the
// Highlighter paints and Backspace removes whole; Escape keeps the list closed while typing on;
// "/" runs an action (the query removed, onSelect called); server HTML and hydration.
import type { MentionsQuery } from "@rind-ui/core"
import { Mentions, type MentionsRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getMentions } from "../index"

afterEach(() => vi.restoreAllMocks())

const PEOPLE = ["Alice", "Alan", "Bob"]
const COMMANDS = ["Clear", "Summarise"]

function Field(props: Partial<MentionsRootProps>) {
  const [query, setQuery] = useState<MentionsQuery | null>(null)
  const list = query?.trigger === "/" ? COMMANDS : PEOPLE
  return (
    <Mentions.Root
      triggers={[{ char: "@" }, { char: "/", behavior: "action", startOfInput: true }]}
      onQueryChange={setQuery}
      {...props}
    >
      <label htmlFor="msg">Message</label>
      <Mentions.Highlighter />
      <Mentions.Textarea id="msg" />
      <Mentions.Description />
      <Mentions.Positioner>
        <Mentions.Popup>
          <Mentions.List>
            {list.map((name) => (
              <Mentions.Item key={name} value={name.toLowerCase()}>
                <Mentions.ItemText>{name}</Mentions.ItemText>
              </Mentions.Item>
            ))}
          </Mentions.List>
          <Mentions.Empty>No match</Mentions.Empty>
        </Mentions.Popup>
      </Mentions.Positioner>
    </Mentions.Root>
  )
}

function setup(props: Partial<MentionsRootProps> = {}) {
  const r = render(
    <RindProvider>
      <Field {...props} />
    </RindProvider>,
  )
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return { host: r.container, q, d: () => getMentions(document.body, { name: "Message" }) }
}

const settle = () => act(async () => {})

describe("React Mentions", () => {
  it("a textbox described by its triggers; no combobox state while closed", async () => {
    const t = setup()
    await settle()
    const box = screen.getByRole("textbox", { name: "Message" })
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
    expect(screen.getByRole("combobox", { name: "Message" }).getAttribute("aria-expanded")).toBe(
      "true",
    )
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

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Field
            defaultValue="Hi @Bob "
            defaultMentions={[{ id: "bob", trigger: "@", start: 3, end: 7 }]}
          />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-part="mention"]')?.textContent).toBe("@Bob")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
