// Closed tooltips cost nothing (spec "Closed Tooltips Cost Nothing"), in real browsers: 200
// closed tooltips create no positioning observer, no hover-intent document or window listener
// and no timer; their number never changes the shared listeners; hovering one re-renders only
// that instance (radix#3858, bits-ui#1687). Calls are attributed to the library by their stack.
import { Tooltip } from "@rind-ui/react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Profiler } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const fromLibrary = () => {
  const stack = new Error().stack ?? ""
  return /\/packages\/(core|react)\/src\//.test(stack) || /@rind-ui\/(core|react)/.test(stack)
}

/** The targets whose listeners are document- or window-level. */
const nameOf = (t: EventTarget) =>
  t === document
    ? "document"
    : t === window
      ? "window"
      : t === document.documentElement
        ? "html"
        : t === window.visualViewport
          ? "visualViewport"
          : null

/** Records what the library registers: listeners, observers and timers. */
function spy() {
  const listeners: string[] = []
  const observers: string[] = []
  const timers: string[] = []
  const add = EventTarget.prototype.addEventListener
  vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (
    this: EventTarget,
    type: string,
    ...rest: [unknown, unknown?]
  ) {
    const where = nameOf(this)
    if (where && fromLibrary()) listeners.push(`${where}:${type}`)
    return add.call(this, type, ...(rest as [EventListenerOrEventListenerObject]))
  })
  for (const name of ["ResizeObserver", "IntersectionObserver", "MutationObserver"] as const) {
    const Original = globalThis[name] as unknown as new (cb: never) => object
    vi.stubGlobal(
      name,
      class extends Original {
        constructor(cb: never) {
          super(cb)
          if (fromLibrary()) observers.push(name)
        }
      },
    )
  }
  for (const name of ["setTimeout", "setInterval", "requestAnimationFrame"] as const) {
    const original = globalThis[name] as (...a: unknown[]) => unknown
    vi.stubGlobal(name, (...a: unknown[]) => {
      if (fromLibrary()) timers.push(name)
      return original(...a)
    })
  }
  return { listeners, observers, timers }
}

const settle = async () => {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    await new Promise((r) => setTimeout(r, 50))
  })
}

function Many({ count, onRender }: { count: number; onRender?: (id: number) => void }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
        <Profiler key={i} id={String(i)} onRender={() => onRender?.(i)}>
          <Tooltip.Root openDelay={0}>
            <Tooltip.Trigger>{`Item ${i}`}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>{`Tip ${i}`}</Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Profiler>
      ))}
    </>
  )
}

describe("Closed tooltips cost nothing", () => {
  async function mountMany() {
    const seen = spy()
    render(<Many count={200} />)
    await settle()
    expect(screen.getAllByRole("button")).toHaveLength(200)
    return seen
  }

  it("200 closed tooltips hold no observer (positioning, portal sync)", async () => {
    const seen = await mountMany()
    expect(seen.observers, "observers held by closed tooltips").toEqual([])
  })

  it("200 closed tooltips hold no timer", async () => {
    const seen = await mountMany()
    expect(seen.timers, "timers").toEqual([])
  })

  it("200 closed tooltips hold no hover-intent, layer or positioning listener on the document or window", async () => {
    const seen = await mountMany()
    // Hover intent and positioning register these only while open (the modality tracker's
    // few shared listeners exist once, whatever the number of tooltips: next test).
    for (const l of seen.listeners) {
      expect(l, `a closed tooltip registered ${l}`).not.toMatch(
        /^(document:(pointermove|scroll)|html:pointerleave|window:resize|visualViewport:resize)$/,
      )
    }
  })

  it("the shared listeners do not grow with the number of tooltips", async () => {
    const one = spy()
    const { unmount } = render(<Many count={1} />)
    await settle()
    const base = [...one.listeners].sort()
    unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    const many = spy()
    render(<Many count={200} />)
    await settle()
    expect([...many.listeners].sort()).toEqual(base)
  })

  it("a closed tooltip creates no layer and no positioner style work", async () => {
    render(<Many count={5} />)
    await settle()
    const positioners = document.querySelectorAll('[data-part="positioner"]')
    expect(positioners).toHaveLength(5)
    for (const p of positioners) {
      expect(p.hasAttribute("hidden")).toBe(true)
      expect(p.getAttribute("data-state")).toBe("closed")
    }
  })

  it("hovering one tooltip re-renders only that instance", async () => {
    const renders = new Map<number, number>()
    render(<Many count={200} onRender={(i) => renders.set(i, (renders.get(i) ?? 0) + 1)} />)
    await settle()
    renders.clear()
    const user = userEvent.setup()
    const target = screen.getByRole("button", { name: "Item 57" })
    const r = target.getBoundingClientRect()
    await act(() =>
      user.pointer({
        target,
        coords: { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
      }),
    )
    await settle()
    expect(renders.get(57) ?? 0).toBeGreaterThan(0)
    const others = [...renders].filter(([i]) => i !== 57)
    expect(others, `other instances re-rendered: ${JSON.stringify(others.slice(0, 5))}`).toEqual([])
    // open (openDelay 0) and close again: still only that instance
    await act(() => user.keyboard("{Escape}"))
    await settle()
    expect([...renders].filter(([i]) => i !== 57)).toEqual([])
  })

  it("opening one tooltip registers its listeners and closing removes every one", async () => {
    render(<Many count={3} />)
    await settle()
    const seen = spy()
    const removed: string[] = []
    const remove = EventTarget.prototype.removeEventListener
    vi.spyOn(EventTarget.prototype, "removeEventListener").mockImplementation(function (
      this: EventTarget,
      type: string,
      ...rest: [unknown, unknown?]
    ) {
      const where = nameOf(this)
      if (where && fromLibrary()) removed.push(`${where}:${type}`)
      return remove.call(this, type, ...(rest as [EventListenerOrEventListenerObject]))
    })
    const user = userEvent.setup()
    const target = screen.getByRole("button", { name: "Item 1" })
    await act(() => user.tab())
    await act(() => user.tab())
    expect(document.activeElement).toBe(target)
    await settle()
    expect(seen.listeners.length).toBeGreaterThan(0)
    expect(seen.observers.length).toBeGreaterThan(0) // positioning observes while open
    await act(() => user.keyboard("{Escape}"))
    await settle()
    // every listener the open tooltip added (hover-intent and layer) was removed again
    for (const l of seen.listeners) expect(removed, l).toContain(l)
  })
})
