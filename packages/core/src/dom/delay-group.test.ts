// The document delay group (openspec add-tooltip, delay-group): every scenario in Node. A
// "document" is any object: the group lives on it under a versioned global key, so two
// `domDelayGroup()` instances on one object are two copies of the library, and two objects
// are two documents (iframes). The warm window runs on vi fake timers through the scheduler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DelayGroup } from "../env/delay-group"
import { domDelayGroup } from "./delay-group"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const scheduler = {
  setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as never),
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
}
const newDoc = () => ({ body: {} }) as unknown as Document
/** One copy of the library reading `doc`. */
const copy = (doc: Document): DelayGroup =>
  domDelayGroup({ dom: { getRootNode: () => doc } as never, scheduler })
const member = () => ({ replace: vi.fn() })

describe("One Group Per Document", () => {
  it("is stored on the document under a versioned global key", () => {
    const doc = newDoc()
    copy(doc).join("a", member())
    expect(Reflect.get(doc, Symbol.for("rind-ui.delay-group@1"))).toBeDefined()
  })

  it("two library copies share the group: the second opens without delay and the first closes", () => {
    const doc = newDoc()
    const one = copy(doc)
    const two = copy(doc)
    const a = member()
    const b = member()
    one.join("a", a)
    two.join("b", b)
    one.opened("a")
    one.closed("a", 300)
    vi.advanceTimersByTime(100)
    // The other copy sees the warm window and opens: nothing is open to replace now.
    expect(two.isWarm()).toBe(true)
    two.opened("b")
    expect(a.replace).not.toHaveBeenCalled()
    // And while b is open, a opening through copy one replaces b through copy two's join.
    one.opened("a")
    expect(b.replace).toHaveBeenCalledTimes(1)
    expect(two.isWarm()).toBe(true)
  })

  it("an open member of one copy is replaced by a member of the other", () => {
    const doc = newDoc()
    const one = copy(doc)
    const two = copy(doc)
    const a = member()
    one.join("a", a)
    two.join("b", member())
    one.opened("a")
    two.opened("b")
    expect(a.replace).toHaveBeenCalledTimes(1)
  })

  it("iframes: a tooltip open in the main document does not warm or replace the iframe's", () => {
    const main = newDoc()
    const frame = newDoc()
    const m = copy(main)
    const f = copy(frame)
    const inMain = member()
    m.join("a", inMain)
    f.join("b", member())
    m.opened("a")
    expect(m.isWarm()).toBe(true)
    // The iframe's group is cold: its tooltip waits for its own delay...
    expect(f.isWarm()).toBe(false)
    f.opened("b")
    // ...and the main document's tooltip stays open.
    expect(inMain.replace).not.toHaveBeenCalled()
    f.closed("b", 300)
    expect(m.isWarm()).toBe(true)
    m.closed("a", 0)
    expect(m.isWarm()).toBe(false)
    expect(f.isWarm()).toBe(true)
  })

  it("a shadow root resolves to its owner document", () => {
    const doc = newDoc()
    const root = { ownerDocument: doc } as unknown as ShadowRoot
    const g = domDelayGroup({ dom: { getRootNode: () => root } as never, scheduler })
    const other = copy(doc)
    g.join("a", member())
    g.opened("a")
    expect(other.isWarm()).toBe(true)
  })
})

describe("One Open Member", () => {
  it("opening a member replaces the open one once, never itself", () => {
    const g = copy(newDoc())
    const a = member()
    const b = member()
    g.join("a", a)
    g.join("b", b)
    g.opened("a")
    g.opened("a")
    expect(a.replace).not.toHaveBeenCalled()
    g.opened("b")
    expect(a.replace).toHaveBeenCalledTimes(1)
    expect(b.replace).not.toHaveBeenCalled()
  })

  it("opened without a preceding close of the previous one still replaces it", () => {
    const g = copy(newDoc())
    const a = member()
    g.join("a", a)
    g.join("b", member())
    g.opened("a")
    g.opened("b")
    expect(a.replace).toHaveBeenCalledTimes(1)
  })

  it("a replaced member closing late does not cool the group while the new one is open", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.join("b", member())
    g.opened("a")
    g.opened("b")
    g.closed("a", 300) // a closes after being replaced: b is the open one
    vi.advanceTimersByTime(10_000)
    expect(g.isWarm()).toBe(true)
    g.closed("b", 300)
    vi.advanceTimersByTime(300)
    expect(g.isWarm()).toBe(false)
  })

  it("closed() of a member that is not open is ignored", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.closed("a", 300)
    expect(g.isWarm()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe("Warm Window", () => {
  it("is cold with no member open and no recent close", () => {
    expect(copy(newDoc()).isWarm()).toBe(false)
  })

  it("is warm while a member is open, however long", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    vi.advanceTimersByTime(60_000)
    expect(g.isWarm()).toBe(true)
  })

  it("toolbar sweep: warm for the skip delay after the last close, cold at exactly the delay", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 300)
    expect(g.isWarm()).toBe(true)
    vi.advanceTimersByTime(299)
    expect(g.isWarm()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(g.isWarm()).toBe(false)
  })

  it("cold again: closed 400 ms ago", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 300)
    vi.advanceTimersByTime(400)
    expect(g.isWarm()).toBe(false)
  })

  it("the window length is the closing member's skipDelay", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 1000)
    vi.advanceTimersByTime(999)
    expect(g.isWarm()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(g.isWarm()).toBe(false)
    g.opened("a")
    g.closed("a", 50)
    vi.advanceTimersByTime(50)
    expect(g.isWarm()).toBe(false)
  })

  it("close delay does not extend the window: it depends on the skip delay only", () => {
    // A tooltip with closeDelay 0 closes at t0; the window is 300 from then, not longer, so a
    // hover 350 ms later is cold (react-spectrum#9517). The group takes no close delay.
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 300)
    vi.advanceTimersByTime(350)
    expect(g.isWarm()).toBe(false)
  })

  it("skip delay 0 makes the group cold as soon as the last member closes, with no timer", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 0)
    expect(g.isWarm()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("a negative skip delay behaves as 0", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", -5)
    expect(g.isWarm()).toBe(false)
  })

  it("opening inside the window cancels the cool-down: the window restarts on the next close", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.join("b", member())
    g.opened("a")
    g.closed("a", 300)
    vi.advanceTimersByTime(200)
    g.opened("b")
    vi.advanceTimersByTime(5000)
    expect(g.isWarm()).toBe(true)
    g.closed("b", 300)
    vi.advanceTimersByTime(299)
    expect(g.isWarm()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(g.isWarm()).toBe(false)
  })

  it("a second close restarts the window rather than stacking timers", () => {
    const g = copy(newDoc())
    g.join("a", member())
    g.opened("a")
    g.closed("a", 300)
    vi.advanceTimersByTime(250)
    g.opened("a")
    g.closed("a", 300)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(299)
    expect(g.isWarm()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(g.isWarm()).toBe(false)
  })

  it("the timer is on the injected scheduler, not on the global one", () => {
    const setTimeoutSpy = vi.fn(() => 1)
    const doc = newDoc()
    const g = domDelayGroup({
      dom: { getRootNode: () => doc } as never,
      scheduler: { ...scheduler, setTimeout: setTimeoutSpy, clearTimeout: vi.fn() },
    })
    g.join("a", member())
    g.opened("a")
    g.closed("a", 300)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe("Membership Lifetime", () => {
  it("leave() of an open member counts as it closing: warm for its skip delay, then cold", () => {
    const g = copy(newDoc())
    const leave = g.join("a", member())
    g.opened("a")
    leave(300)
    expect(g.isWarm()).toBe(true)
    // five seconds later another trigger on the page is hovered: it waits its full delay
    vi.advanceTimersByTime(5000)
    expect(g.isWarm()).toBe(false)
  })

  it("leave() with skipDelay 0 of an open member is cold at once", () => {
    const g = copy(newDoc())
    const leave = g.join("a", member())
    g.opened("a")
    leave(0)
    expect(g.isWarm()).toBe(false)
  })

  it("leave() of a closed member does not warm the group and unregisters it", () => {
    const g = copy(newDoc())
    const a = member()
    const leave = g.join("a", a)
    g.join("b", member())
    leave(300)
    expect(g.isWarm()).toBe(false)
    g.opened("b")
    g.opened("a") // a is gone: nothing replaces b through a's old registration
    expect(a.replace).not.toHaveBeenCalled()
  })

  it("a removed member is never replaced afterwards", () => {
    const g = copy(newDoc())
    const a = member()
    const leave = g.join("a", a)
    g.opened("a")
    leave(0)
    g.join("b", member())
    g.opened("b")
    expect(a.replace).not.toHaveBeenCalled()
  })

  it("leaving an open member while another is open leaves the other open and warm", () => {
    const g = copy(newDoc())
    const leaveA = g.join("a", member())
    g.join("b", member())
    g.opened("b")
    leaveA(300)
    vi.advanceTimersByTime(60_000)
    expect(g.isWarm()).toBe(true)
  })

  it("repeated open requests of the same member do not replace itself or restart anything", () => {
    const g = copy(newDoc())
    const a = member()
    g.join("a", a)
    g.opened("a")
    vi.advanceTimersByTime(100)
    g.opened("a")
    expect(a.replace).not.toHaveBeenCalled()
    expect(g.isWarm()).toBe(true)
    g.closed("a", 300)
    vi.advanceTimersByTime(300)
    expect(g.isWarm()).toBe(false)
  })

  it("a member re-joining with the same id replaces its registration", () => {
    const g = copy(newDoc())
    const old = member()
    const fresh = member()
    g.join("a", old)
    g.join("a", fresh)
    g.join("b", member())
    g.opened("a")
    g.opened("b")
    expect(fresh.replace).toHaveBeenCalledTimes(1)
    expect(old.replace).not.toHaveBeenCalled()
  })
})
