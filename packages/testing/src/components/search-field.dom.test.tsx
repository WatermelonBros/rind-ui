// Search Field through its driver: runs unchanged in jsdom and in real browsers.
import { domEnvironment } from "@rind-ui/core"
import { Dialog, Field, SearchField } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getDialog, getSearchField } from "../index"

const platform = domEnvironment().platform
const opts = { platform }
const search = (name = "Search books") => getSearchField(screen, { name }, opts)
const input = () => screen.getByRole("searchbox") as HTMLInputElement

function Books(props: Parameters<typeof SearchField.Root>[0] & { readonly clear?: boolean }) {
  const { clear = true, ...root } = props
  return (
    <SearchField.Root {...root}>
      <SearchField.Label>Search books</SearchField.Label>
      <SearchField.Input />
      {clear ? <SearchField.ClearTrigger /> : null}
    </SearchField.Root>
  )
}

function InDialog(props: Parameters<typeof SearchField.Root>[0]) {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger>Find</Dialog.Trigger>
      <Dialog.Positioner style={{ position: "fixed", inset: 0 }}>
        <Dialog.Content>
          <Dialog.Title>Find</Dialog.Title>
          <Books {...props} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("SearchField", () => {
  it("Searchbox: one searchbox named by the label, search semantics", () => {
    render(<Books />)
    expect(screen.getAllByRole("searchbox")).toHaveLength(1)
    expect(input().type).toBe("search")
    expect(input().getAttribute("enterkeyhint")).toBe("search")
  })

  it("Icon-only search box: aria-label names it, no warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <SearchField.Root>
        <SearchField.Input aria-label="Search" />
      </SearchField.Root>,
    )
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeTruthy()
    expect(warn).not.toHaveBeenCalled()
  })

  it("Clear inside a dialog: Escape clears, keeps focus, the dialog stays open", async () => {
    const onValueChange = vi.fn()
    render(<InDialog onValueChange={onValueChange} />)
    const s = search()
    await s.type("tolkien")
    await s.escape()
    expect(await s.value()).toBe("")
    expect(document.activeElement).toBe(input())
    expect(onValueChange).toHaveBeenLastCalledWith(
      "",
      expect.objectContaining({ reason: "ESCAPE" }),
    )
    expect(await getDialog(screen, { name: "Find" }, opts).isOpen()).toBe(true)
  })

  it("Empty field lets the dialog close (react-spectrum#5480)", async () => {
    render(<InDialog />)
    await search().escape()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
  })

  it("Keyboard twin of clear: via keyboard, clear presses Escape", async () => {
    render(<Books defaultValue="a" />)
    await search().via("keyboard").clear()
    expect(await search().value()).toBe("")
  })

  it("Escape during composition does not clear (react-spectrum#10249)", async () => {
    render(<Books />)
    const s = search()
    await s.type("a")
    await s.part("input").compose(["ㅎ", "한"])
    await s.part("input").press("Escape")
    expect(await s.value()).not.toBe("")
    await s.part("input").compose([], "한")
  })

  it("IME commit is not a search (react-spectrum#6421)", async () => {
    const onSubmit = vi.fn()
    render(<Books onSubmit={onSubmit} />)
    const s = search()
    await s.compose("被送", "被送出")
    expect(onSubmit).not.toHaveBeenCalled()
    await s.submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toBe("被送出")
  })

  it("Search form: onSubmit once, the form submits with q", async () => {
    const onSubmit = vi.fn()
    let data: FormData | null = null
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          data = new FormData(e.currentTarget)
        }}
      >
        <Books name="q" onSubmit={onSubmit} />
      </form>,
    )
    await search().type("dune")
    await search().submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(data?.get("q")).toBe("dune"))
  })

  it("Clear re-validates (react-spectrum#7265)", async () => {
    render(
      <Field.Root
        validationMode="change"
        // The tooShort rule as a validator: jsdom computes no native tooShort.
        validate={(v) => (String(v).length > 0 && String(v).length < 3 ? "Too short" : null)}
      >
        <Field.Label>Search books</Field.Label>
        <SearchField.Root>
          <SearchField.Input minLength={3} />
          <SearchField.ClearTrigger />
        </SearchField.Root>
        <Field.ErrorMessage />
      </Field.Root>,
    )
    const s = search()
    await s.type("ab")
    await waitFor(() => expect(input().getAttribute("aria-invalid")).toBe("true"))
    await s.clear()
    expect(await s.value()).toBe("")
    await waitFor(() => expect(input().getAttribute("aria-invalid")).toBe(null))
  })

  it("One clear control: the native cancel button is hidden only with a ClearTrigger", async () => {
    const { unmount } = render(<Books defaultValue="x" />)
    expect(input().hasAttribute("data-custom-clear")).toBe(true)
    expect(document.head.querySelector('style[data-rind-style="search-field-cancel"]')).not.toBe(
      null,
    )
    unmount()
    render(<Books defaultValue="x" clear={false} />)
    expect(input().hasAttribute("data-custom-clear")).toBe(false)
  })

  it("Localised clear", () => {
    render(<Books defaultValue="x" messages={{ clear: "Cancella ricerca" }} />)
    expect(screen.getByRole("button", { name: "Cancella ricerca", hidden: true })).toBeTruthy()
  })

  it("Clear search is the default name, out of the tab order", () => {
    render(<Books defaultValue="x" />)
    const t = screen.getByRole("button", { name: "Clear search", hidden: true })
    expect(t.tabIndex).toBe(-1)
  })

  it("Empty attribute on root and input", async () => {
    render(<Books defaultValue="x" />)
    const root = document.querySelector('[data-scope="search-field"][data-part="root"]')
    expect(root?.hasAttribute("data-empty")).toBe(false)
    await search().clear()
    expect(await search().isEmpty()).toBe(true)
    expect(root?.hasAttribute("data-empty")).toBe(true)
  })

  it("read-only and disabled leave Escape alone", async () => {
    const { unmount } = render(<InDialog defaultValue="a" readOnly />)
    await search().escape()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
    unmount()
    render(<Books defaultValue="a" disabled />)
    act(() => {
      input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(input().value).toBe("a")
  })

  it("a consumer onKeyDown sees Escape first (react-spectrum#2253)", async () => {
    const seen: boolean[] = []
    render(
      <SearchField.Root defaultValue="a">
        <SearchField.Label>Search books</SearchField.Label>
        <SearchField.Input
          onKeyDown={(e) => {
            if (e.key === "Escape") seen.push(e.defaultPrevented)
          }}
        />
      </SearchField.Root>,
    )
    await search().escape()
    expect(seen).toEqual([false])
    expect(await search().value()).toBe("")
  })
})
