// Async and stale results (combobox-pattern "Async And Stale Results", "Empty State";
// combobox "Text Follows External Changes Only When Not Dirty").
import { Combobox, type ComboboxItemData } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { getCombobox, installAnnouncementLog } from "../index"

const parts = (
  <>
    <Combobox.Label>City</Combobox.Label>
    <Combobox.Control>
      <Combobox.Input />
    </Combobox.Control>
    <Combobox.Positioner>
      <Combobox.Popup>
        <Combobox.List>
          <Combobox.Items />
        </Combobox.List>
        <Combobox.Empty>No results</Combobox.Empty>
      </Combobox.Popup>
    </Combobox.Positioner>
  </>
)

const input = () => screen.getByRole("combobox", { name: "City" }) as HTMLInputElement
const item = (label: string): ComboboxItemData => ({ key: label.toLowerCase(), label })

/** The rendered Remote's responder: the test answers each query when it likes. */
let responder: (q: string, items: ComboboxItemData[]) => void = () => {}

/** A consumer fetching by hand. */
function Remote(props: { readonly signals: Map<string, AbortSignal> }) {
  const [state, setState] = useState<{ items: ComboboxItemData[]; query: string }>({
    items: [],
    query: "",
  })
  responder = (q, items) => setState({ items, query: q })
  return (
    <Combobox.Root
      items={state.items}
      filter={null}
      itemsQuery={state.query}
      autoHighlight
      onInputValueChange={(text, d) => props.signals.set(text, d.signal)}
    >
      {parts}
    </Combobox.Root>
  )
}
const respond = (q: string, items: ComboboxItemData[]): void => act(() => responder(q, items))

describe("Combobox async", () => {
  it("out-of-order responses: the older signal is aborted, stale results neither highlight nor empty", async () => {
    const signals = new Map<string, AbortSignal>()
    const log = installAnnouncementLog()
    log.length = 0
    render(<Remote signals={signals} />)
    const cb = getCombobox(screen, { name: "City" })
    await cb.type("ro")
    await cb.type("m")
    expect(signals.get("ro")?.aborted).toBe(true)
    expect(signals.get("rom")?.aborted).toBe(false)
    respond("rom", [item("Rome")])
    await waitFor(() => expect(screen.getByRole("option", { name: "Rome" })).toBeTruthy())
    expect(screen.getByRole("option", { name: "Rome" }).hasAttribute("data-highlighted")).toBe(true)
    // The late "ro" answer: rendered, but stale (no highlight, no empty state, no count).
    log.length = 0
    respond("ro", [])
    expect(screen.queryByText("No results")).toBe(null)
    expect(log.map((a) => a.message)).not.toContain("No results")
  })

  it("async miss then hit: exposed again and counted without reopening", async () => {
    const signals = new Map<string, AbortSignal>()
    const log = installAnnouncementLog()
    render(<Remote signals={signals} />)
    const cb = getCombobox(screen, { name: "City" })
    await cb.type("xq")
    respond("xq", [])
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("false"))
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().keyboard("{Backspace}")
    log.length = 0
    respond("x", [item("Xi'an"), item("Xalapa"), item("Xanthi")])
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("true"))
    await waitFor(() => expect(log.map((a) => a.message)).toContain("3 results"))
  })

  it("closing aborts the last signal", async () => {
    const signals = new Map<string, AbortSignal>()
    render(<Remote signals={signals} />)
    const cb = getCombobox(screen, { name: "City" })
    await cb.type("r")
    await cb.pressEscape()
    expect(signals.get("r")?.aborted).toBe(true)
  })

  it("a default value shows its text once its collection arrives", async () => {
    function Late() {
      const [items, setItems] = useState<ComboboxItemData[]>([])
      ;(Late as unknown as { load: () => void }).load = () => setItems([item("Italy")])
      return (
        <Combobox.Root items={items} defaultValue="italy">
          {parts}
        </Combobox.Root>
      )
    }
    render(<Late />)
    expect(input().value).toBe("")
    act(() => (Late as unknown as { load: () => void }).load())
    await waitFor(() => expect(input().value).toBe("Italy"))
  })
})
