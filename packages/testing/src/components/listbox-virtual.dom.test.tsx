// Virtualization (tasks 5.3): navigation over the whole collection while only a window is
// rendered, scroll-to-index, typeahead to an unmounted item, set metadata after a filter.
import { createListCollection, type ScrollToIndexDetails } from "@rind-ui/core"
import { Listbox } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

const N = 10_000
const ITEMS = Array.from({ length: N }, (_, i) => ({
  key: `i${i}`,
  label: i === 7_777 ? "Zebra" : `Item ${i}`,
}))
const full = createListCollection({ items: ITEMS, getKey: (x) => x.key, getText: (x) => x.label })

/** A windowed list: renders 20 items around `start`, scrolls the window on scrollToIndex. */
function Windowed({ onScroll }: { readonly onScroll: (d: ScrollToIndexDetails) => void }) {
  const [start, setStart] = useState(0)
  const window = ITEMS.slice(start, start + 20)
  return (
    <Listbox.Root
      collection={full}
      virtualized
      scrollToIndex={(d) => {
        onScroll(d)
        setStart(Math.max(0, Math.min(N - 20, d.index - 10)))
      }}
    >
      <Listbox.List aria-label="Big">
        {window.map((x) => (
          <Listbox.Item key={x.key} value={x.key}>
            {x.label}
          </Listbox.Item>
        ))}
      </Listbox.List>
    </Listbox.Root>
  )
}

const key = (k: string) =>
  act(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  })

describe("virtualized Listbox", () => {
  it("End reaches item 10,000 through scrollToIndex; it is then rendered and focused", async () => {
    const onScroll = vi.fn()
    render(<Windowed onScroll={onScroll} />)
    act(() => screen.getAllByRole("option")[0]?.focus())
    key("End")
    expect(onScroll).toHaveBeenLastCalledWith(expect.objectContaining({ index: N - 1 }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe(`Item ${N - 1}`))
  })

  it("typeahead to an unmounted item", async () => {
    const onScroll = vi.fn()
    render(<Windowed onScroll={onScroll} />)
    act(() => screen.getAllByRole("option")[0]?.focus())
    key("z")
    expect(onScroll).toHaveBeenLastCalledWith(expect.objectContaining({ index: 7_777 }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Zebra"))
  })

  it("aria-setsize and aria-posinset come from the whole collection, also after a filter", () => {
    const { rerender } = render(<Windowed onScroll={() => {}} />)
    const first = screen.getAllByRole("option")[0]
    expect(first?.getAttribute("aria-setsize")).toBe(String(N))
    expect(first?.getAttribute("aria-posinset")).toBe("1")
    const filtered = full.filter((n) => n.key === "i5" || n.key === "i9")
    rerender(
      <Listbox.Root collection={filtered} virtualized>
        <Listbox.List aria-label="Big">
          <Listbox.Item value="i5">Item 5</Listbox.Item>
          <Listbox.Item value="i9">Item 9</Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(
      screen
        .getAllByRole("option")
        .map((o) => [o.getAttribute("aria-posinset"), o.getAttribute("aria-setsize")]),
    ).toEqual([
      ["1", "2"],
      ["2", "2"],
    ])
  })
})
