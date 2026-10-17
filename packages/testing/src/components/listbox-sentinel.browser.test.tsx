// Infinite scroll (spec "Loading And Virtualization"): the sentinel calls onLoadMore once per
// collection, however often it scrolls into view, and the list is busy while loading more.
import { Listbox } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `i${i}`, label: `Item ${i}` }))

describe("Listbox load more", () => {
  it("one onLoadMore per collection; aria-busy while loading more", async () => {
    const onLoadMore = vi.fn()
    const list = items(30)
    const ui = (loading: "idle" | "loading-more") => (
      <Listbox.Root items={list} loading={loading} onLoadMore={onLoadMore}>
        <Listbox.List aria-label="Feed" style={{ height: 120, overflow: "auto" }}>
          <Listbox.Items />
          <Listbox.LoadMore style={{ height: 1 }} />
        </Listbox.List>
      </Listbox.Root>
    )
    const { rerender } = render(ui("idle"))
    const scroller = screen.getByRole("listbox")
    expect(onLoadMore).not.toHaveBeenCalled()
    scroller.scrollTo({ top: scroller.scrollHeight })
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1))
    scroller.scrollTo({ top: 0 })
    scroller.scrollTo({ top: scroller.scrollHeight })
    // The same collection: no second request.
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    rerender(ui("loading-more"))
    expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true")
  })
})
