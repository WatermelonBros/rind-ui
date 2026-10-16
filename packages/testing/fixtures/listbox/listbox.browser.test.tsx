// DOM-dependent collection scenarios with real layout and real input (add-collections 7.4):
// measured page moves, scrolling that follows navigation only, the zero-delta pointer guard,
// roving focus repair, registration batching, re-render counts and the SSR tab stop.
import { act, render, waitFor } from "@testing-library/react"
import { Profiler, type ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { Listbox, type ListboxItemData } from "./listbox.react"

const ITEM = 20
const items = (n: number, disabled: readonly number[] = []): ListboxItemData[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `i${i + 1}`,
    label: `Item ${i + 1}`,
    ...(disabled.includes(i + 1) ? { disabled: true } : {}),
  }))

// Fixed row height: page and scroll maths are exact, whatever the browser's font metrics.
const css = `[role="option"]{height:${ITEM}px;margin:0;padding:0;overflow:hidden;box-sizing:border-box}`

function Harness({
  data,
  height = 300,
  children,
}: {
  data?: readonly ListboxItemData[]
  height?: number
  children?: ReactNode
}) {
  return (
    <div>
      <style>{css}</style>
      <Listbox.Root {...(data ? { items: data } : {})} aria-label="Items">
        <Listbox.List aria-label="Items" style={{ height, overflow: "auto", margin: 0 }}>
          {data ? <Listbox.Items /> : children}
        </Listbox.List>
      </Listbox.Root>
    </div>
  )
}

const list = () => document.querySelector<HTMLElement>('[role="listbox"]') as HTMLElement
const lit = () => document.querySelector('[role="option"][data-highlighted]')?.textContent ?? null
const option = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.textContent === label,
  ) as HTMLElement
const press = async (key: string, times = 1) => {
  for (let i = 0; i < times; i++) await userEvent.keyboard(`{${key}}`)
}
/** Tab onto the roving tab stop (the first item: nothing is selected). */
const enter = async () => {
  await userEvent.tab()
  await waitFor(() => expect(lit()).toBe("Item 1"))
}

afterEach(() => vi.restoreAllMocks())

const frames = async (count = 6) => {
  for (let i = 0; i < count; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

describe("page moves", () => {
  it("PageDown in a 300px list of 50 items moves by the visible page, not by 10", async () => {
    render(<Harness data={items(50)} />)
    await enter()
    await press("PageDown")
    // 300px / 20px = 15 rows fit: from row 1 the page ends on row 15.
    await waitFor(() => expect(lit()).toBe("Item 15"))
    await press("PageDown")
    await waitFor(() => expect(lit()).toBe("Item 29"))
    await press("PageUp")
    await waitFor(() => expect(lit()).not.toBe("Item 19"))
  })

  it("stops at the end without looping", async () => {
    render(<Harness data={items(20)} />)
    await enter()
    await press("PageDown", 3)
    await waitFor(() => expect(lit()).toBe("Item 20"))
  })
})

describe("scrolling follows navigation only", () => {
  it("ArrowDown to an item below the fold scrolls it in with the smallest scroll", async () => {
    render(<Harness data={items(50)} />)
    await enter()
    await press("ArrowDown", 14)
    await waitFor(() => expect(lit()).toBe("Item 15"))
    // Item 15 ends exactly at the fold: nothing scrolled.
    expect(list().scrollTop).toBe(0)
    await press("ArrowDown")
    await waitFor(() => expect(lit()).toBe("Item 16"))
    // nearest: just enough to show one more row, not centred.
    expect(list().scrollTop).toBe(ITEM)
  })

  it("a pointer highlight on a partly visible item does not scroll", async () => {
    // 310px: row 16 shows 10px of its 20.
    render(<Harness data={items(50)} height={310} />)
    await enter()
    // Not userEvent.hover: Playwright scrolls its target into view before moving the mouse.
    const rect = option("Item 16").getBoundingClientRect()
    option("Item 16").dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: rect.left + 5,
        clientY: rect.top + 3,
        pointerType: "mouse",
      }),
    )
    await waitFor(() => expect(lit()).toBe("Item 16"))
    expect(list().scrollTop).toBe(0)
  })

  it("appending items while one is highlighted does not change scrollTop", async () => {
    const { rerender } = render(<Harness data={items(50)} />)
    await enter()
    await press("ArrowDown", 24)
    await waitFor(() => expect(lit()).toBe("Item 25"))
    const before = list().scrollTop
    expect(before).toBeGreaterThan(0)
    rerender(<Harness data={items(80)} />)
    await waitFor(() => expect(list().querySelectorAll('[role="option"]')).toHaveLength(80))
    expect(lit()).toBe("Item 25")
    expect(list().scrollTop).toBe(before)
  })
})

describe("pointer guard", () => {
  it("a pointermove with unchanged coordinates keeps the keyboard highlight", async () => {
    render(<Harness data={items(10)} />)
    await enter()
    const moves: { x: number; y: number }[] = []
    document.addEventListener("pointermove", (e) => moves.push({ x: e.clientX, y: e.clientY }), {
      capture: true,
    })
    await userEvent.hover(option("Item 4"))
    await waitFor(() => expect(lit()).toBe("Item 4"))
    const at = moves.at(-1) as { x: number; y: number }
    await press("ArrowDown")
    await waitFor(() => expect(lit()).toBe("Item 5"))
    // The browser re-fires a move at the resting pointer when content moves under it.
    option("Item 4").dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: at.x,
        clientY: at.y,
        pointerType: "mouse",
      }),
    )
    await frames()
    expect(lit()).toBe("Item 5")
  })
})

describe("roving focus repair", () => {
  const tag = (labels: string[], disabled: string[] = []): ListboxItemData[] =>
    labels.map((l) => ({ key: l, label: l, ...(disabled.includes(l) ? { disabled: true } : {}) }))
  const focusedLabel = () => document.activeElement?.textContent ?? null

  it("Delete the focused tag: the next one is highlighted and focused", async () => {
    const { rerender } = render(<Harness data={tag(["a", "b", "c"])} />)
    await userEvent.tab()
    await press("ArrowDown")
    await waitFor(() => expect(focusedLabel()).toBe("b"))
    rerender(<Harness data={tag(["a", "c"])} />)
    await waitFor(() => expect(focusedLabel()).toBe("c"))
    expect(lit()).toBe("c")
  })

  it("Delete the last tag: the previous one is focused, never <body>", async () => {
    const { rerender } = render(<Harness data={tag(["a", "b", "c"])} />)
    await userEvent.tab()
    await press("End")
    await waitFor(() => expect(focusedLabel()).toBe("c"))
    rerender(<Harness data={tag(["a", "b"])} />)
    await waitFor(() => expect(focusedLabel()).toBe("b"))
    expect(document.activeElement).not.toBe(document.body)
    expect(lit()).toBe("b")
  })

  it("Delete next to disabled items: the nearest navigable one before it", async () => {
    const { rerender } = render(<Harness data={tag(["a", "b", "c", "d"], ["c", "d"])} />)
    await userEvent.tab()
    await press("ArrowDown")
    await waitFor(() => expect(focusedLabel()).toBe("b"))
    rerender(<Harness data={tag(["a", "c", "d"], ["c", "d"])} />)
    await waitFor(() => expect(focusedLabel()).toBe("a"))
    expect(lit()).toBe("a")
  })
})

describe("registration and re-renders", () => {
  it("1,000 static parts register in one commit: one collection change", async () => {
    // The machine sees a collection change whenever the root hands it a new collection, and the
    // root only re-renders for a new one. So the Profiler on the Root counts them: the mount
    // commit (no collection yet) plus exactly one commit that carries all 1,000 items.
    let commits = 0
    const keys = items(1000)
    render(
      <Profiler id="root" onRender={() => commits++}>
        <Listbox.Root aria-label="Items">
          <Listbox.List aria-label="Items">
            {keys.map((k) => (
              <Listbox.Item key={k.key} value={k.key}>
                {k.label}
              </Listbox.Item>
            ))}
          </Listbox.List>
        </Listbox.Root>
      </Profiler>,
    )
    await waitFor(() => expect(list().getAttribute("aria-busy")).not.toBe("true"))
    await userEvent.tab()
    await waitFor(() => expect(lit()).toBe("Item 1"))
    await frames()
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1000)
    expect(option("Item 1000").getAttribute("aria-setsize")).toBe("1000")
    // mount, the one registration flush, and the highlight/focus commits of entering the list.
    const afterEntering = commits
    await press("ArrowDown")
    await waitFor(() => expect(lit()).toBe("Item 2"))
    expect(afterEntering).toBeLessThanOrEqual(4)
  })

  it("a highlight move re-renders only the two items involved", async () => {
    const renders = new Map<string, number>()
    const keys = items(100)
    render(
      <Listbox.Root aria-label="Items">
        <Listbox.List aria-label="Items">
          {keys.map((k) => (
            <Profiler
              key={k.key}
              id={k.key}
              onRender={(id) => renders.set(id, (renders.get(id) ?? 0) + 1)}
            >
              <Listbox.Item value={k.key}>{k.label}</Listbox.Item>
            </Profiler>
          ))}
        </Listbox.List>
      </Listbox.Root>,
    )
    // Static parts register after the first commit: the tab stop exists once they have.
    await waitFor(() =>
      expect(document.querySelector('[role="option"][tabindex="0"]')).not.toBeNull(),
    )
    await userEvent.tab()
    await waitFor(() => expect(lit()).toBe("Item 1"))
    const before = new Map(renders)
    await press("ArrowDown")
    await waitFor(() => expect(lit()).toBe("Item 2"))
    await frames()
    const changed = keys
      .map((k) => k.key)
      .filter((k) => (renders.get(k) ?? 0) !== (before.get(k) ?? 0))
    expect(changed).toEqual(["i1", "i2"])
  })
})

describe("server render and hydration", () => {
  const ui = (
    <Listbox.Root items={items(5)} defaultValue={["i2"]} selectionMode="single" aria-label="Items">
      <Listbox.List aria-label="Items">
        <Listbox.Items />
      </Listbox.List>
    </Listbox.Root>
  )

  it("the HTML gives the selected item tabindex 0 and the others -1; hydration is clean", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(ui)
    document.body.append(container)
    const tab = (label: string) =>
      [...container.querySelectorAll('[role="option"]')]
        .find((o) => o.textContent === label)
        ?.getAttribute("tabindex")
    expect(tab("Item 2")).toBe("0")
    for (const l of ["Item 1", "Item 3", "Item 4", "Item 5"]) expect(tab(l)).toBe("-1")
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, ui)
    })
    expect(error).not.toHaveBeenCalled()
    expect(tab("Item 2")).toBe("0")
    act(() => root?.unmount())
    container.remove()
  })
})
