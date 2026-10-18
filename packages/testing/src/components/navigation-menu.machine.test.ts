// The Navigation Menu machine in Node: every transition with a scheduler and clock on vi
// fake timers. Without a `document` the `shown` and `follow` effects are no-ops, so the
// zone events they would emit (`HOVER.END` with `item: null`) are sent by hand.

import {
  createService,
  type NavigationMenuEvent,
  type NavigationMenuProps,
  navigationMenuLevel,
  navigationMenuMachine,
} from "@rind-ui/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function make(over: Partial<NavigationMenuProps> = {}, transit = { on: false }) {
  const env = {
    dom: { getById: () => null, activeElement: () => null, getRootNode: () => ({ body: {} }) },
    modality: { modality: () => "pointer" },
    clock: { now: () => Date.now() },
    hoverIntent: { isInTransit: () => transit.on },
    scheduler: {
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as never),
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
    },
  }
  const onValueChange = vi.fn()
  let props: NavigationMenuProps = { root: "n", onValueChange, ...over }
  const s = createService(navigationMenuMachine, props as never, env as never)
  s.start()
  return {
    s,
    state: () => s.getSnapshot().state as string,
    value: () => (s.view().values as Record<string, unknown>)["value"],
    send: (e: NavigationMenuEvent) => s.send(e as never),
    setProps: (p: Partial<NavigationMenuProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    changes: () => onValueChange.mock.calls.map((c) => [c[0], c[1].reason]),
  }
}

const hover = (item: string): NavigationMenuEvent => ({ type: "HOVER.START", item })
const leave = (item: string | null): NavigationMenuEvent => ({ type: "HOVER.END", item })
const press = (
  item: string,
  modality: "pointer" | "keyboard" = "pointer",
): NavigationMenuEvent => ({
  type: "PRESS",
  item,
  modality,
})

describe("navigation menu machine: hover", () => {
  it("opens after the open delay, closes after the close delay, then warm, then closed", () => {
    const m = make()
    m.send(hover("products"))
    expect(m.state()).toBe("opening")
    m.advance(199)
    expect(m.value()).toBe(null)
    m.advance(1)
    expect([m.state(), m.value()]).toEqual(["open", "products"])
    m.send(leave(null))
    expect(m.state()).toBe("closing")
    m.advance(300)
    expect([m.state(), m.value()]).toEqual(["warm", null])
    m.advance(300)
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      ["products", "trigger-hover"],
      [null, "pointer-leave"],
    ])
  })

  it("leaving the trigger before the delay cancels it", () => {
    const m = make()
    m.send(hover("products"))
    m.send(leave("products"))
    m.advance(500)
    expect(m.state()).toBe("closed")
  })

  it("warm window: the next hover opens with no delay", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.send(leave(null))
    m.advance(300)
    m.send(hover("b"))
    expect([m.state(), m.value()]).toEqual(["open", "b"])
    expect(m.s.getSnapshot().context.instant).toBe(true)
  })

  it("switching while open is immediate, one change, previous recorded", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.send(hover("b"))
    expect(m.value()).toBe("b")
    expect(m.s.getSnapshot().context.previous).toBe("a")
    expect(m.changes()).toEqual([
      ["a", "trigger-hover"],
      ["b", "trigger-hover"],
    ])
  })

  it("re-entering the zone during the close delay keeps it open", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.send(leave(null))
    m.send(hover("a"))
    m.advance(1000)
    expect([m.state(), m.value()]).toEqual(["open", "a"])
  })

  it("openOnHover false and disabled items never open by hover", () => {
    const m = make({ openOnHover: false })
    m.send(hover("a"))
    expect(m.state()).toBe("closed")
    const d = make({ isItemDisabled: (k) => k === "a" })
    d.send(hover("a"))
    d.advance(500)
    expect(d.state()).toBe("closed")
  })

  it("in transit towards a panel, another trigger does not open", () => {
    const transit = { on: false }
    const m = make({}, transit)
    m.send(hover("a"))
    m.advance(200)
    transit.on = true
    // The guard asks hover intent only where a document exists.
    vi.stubGlobal("document", {})
    m.send(hover("b"))
    vi.unstubAllGlobals()
    expect(m.value()).toBe("a")
  })
})

describe("navigation menu machine: press", () => {
  it("toggles exactly once per press; Enter reports trigger-key", () => {
    const m = make()
    m.send(press("a", "keyboard"))
    expect(m.value()).toBe("a")
    m.send(press("a", "keyboard"))
    expect(m.value()).toBe(null)
    expect(m.changes()).toEqual([
      ["a", "trigger-key"],
      [null, "trigger-key"],
    ])
  })

  it("patient click: a press soon after a hover open keeps it open and pins it", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.advance(100)
    m.send(press("a"))
    expect(m.value()).toBe("a")
    m.send(leave(null))
    m.advance(1000)
    expect(m.value()).toBe("a")
  })

  it("a press after the patient window closes; hover does not reopen until the pointer leaves", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.advance(600)
    m.send(press("a"))
    expect(m.value()).toBe(null)
    m.advance(1000)
    m.send(hover("a"))
    m.advance(500)
    expect(m.value()).toBe(null)
    m.send(leave("a"))
    m.send(hover("a"))
    m.advance(200)
    expect(m.value()).toBe("a")
  })

  it("a press on another trigger switches", () => {
    const m = make()
    m.send(press("a"))
    m.send(press("b"))
    expect(m.value()).toBe("b")
    expect(m.changes().at(-1)).toEqual(["b", "trigger-press"])
  })

  it("press-opened panels ignore the pointer leaving", () => {
    const m = make()
    m.send(press("a"))
    m.send(leave(null))
    m.advance(1000)
    expect(m.value()).toBe("a")
  })
})

describe("navigation menu machine: closing", () => {
  it.each([
    [{ type: "ESCAPE" } as NavigationMenuEvent, "escape-key"],
    [{ type: "DISMISS", reason: "outside-press" } as NavigationMenuEvent, "outside-press"],
    [{ type: "DISMISS", reason: "outside-focus" } as NavigationMenuEvent, "outside-focus"],
    [{ type: "LINK.ACTIVATE" } as NavigationMenuEvent, "link-activate"],
    [{ type: "PARENT.CLOSE" } as NavigationMenuEvent, "parent-close"],
    [{ type: "CLOSE" } as NavigationMenuEvent, "api"],
  ])("%o closes with its reason", (event, reason) => {
    const m = make()
    m.send(press("a"))
    m.send(event)
    expect(m.value()).toBe(null)
    expect(m.changes().at(-1)).toEqual([null, reason])
  })

  it("Escape suppresses hover on that item until the pointer leaves it", () => {
    const m = make()
    m.send(hover("a"))
    m.advance(200)
    m.send({ type: "ESCAPE" })
    m.send(hover("a"))
    m.advance(500)
    expect(m.value()).toBe(null)
  })

  it("disabling the open item's trigger closes it with reason api", () => {
    let off = false
    const m = make({ isItemDisabled: () => off })
    m.send(press("a"))
    off = true
    m.send({ type: "DISABLED" })
    expect(m.changes().at(-1)).toEqual([null, "api"])
  })
})

describe("navigation menu machine: controlled", () => {
  it("a refused open leaves it closed; an accepted one opens", () => {
    const refuse = vi.fn((_: unknown, d: { cancel(): void }) => d.cancel())
    const m = make({ value: null, onValueChange: refuse as never })
    m.send(press("a"))
    expect(m.state()).toBe("closed")
    expect(m.value()).toBe(null)
  })

  it("a parent's value opens and closes without onValueChange", () => {
    const m = make({ value: null })
    m.setProps({ value: "a" })
    expect([m.state(), m.value()]).toEqual(["open", "a"])
    m.setProps({ value: null })
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([])
  })

  it("defaultValue opens at start without onValueChange", () => {
    const m = make({ defaultValue: "docs" })
    expect([m.state(), m.value()]).toEqual(["open", "docs"])
    expect(m.changes()).toEqual([])
  })
})

describe("navigation menu tree", () => {
  it("closeTree closes every level, deepest first", () => {
    const order: string[] = []
    const root = navigationMenuLevel(null, {
      close: () => order.push("root"),
      openOnHover: () => false,
    })
    const child = navigationMenuLevel(root, {
      close: () => order.push("child"),
      openOnHover: () => true,
    })
    root.add(child)
    const grandchild = navigationMenuLevel(child, {
      close: () => order.push("grandchild"),
      openOnHover: () => true,
    })
    child.add(grandchild)
    grandchild.closeTree()
    expect(order).toEqual(["grandchild", "child", "root"])
    // A Sub inherits the root's openOnHover.
    expect(grandchild.openOnHover()).toBe(false)
  })
})
