// Press against the event sequences browsers and assistive technology produce
// (accessibility.md §4, AT note root cause A). Each bug cited in the spec is reproduced.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlatformFlags } from "../env/capabilities"
import { domEnvironment } from "../env/dom-environment"
import { platforms } from "./platform"
import { createPress, type PressHandle } from "./press"

let el: HTMLElement
let events: string[]
let handle: PressHandle
let detach: () => void
let unsubscribe: () => void

const EVENT_NAMES: Record<string, string> = {
  onPointerDown: "pointerdown",
  onPointerUp: "pointerup",
  onPointerEnter: "pointerenter",
  onPointerLeave: "pointerleave",
  onPointerCancel: "pointercancel",
  onMouseDown: "mousedown",
  onClick: "click",
  onKeyDown: "keydown",
  onKeyUp: "keyup",
  onContextMenu: "contextmenu",
  onDragStart: "dragstart",
}

function attach(target: HTMLElement, props: PressHandle["props"]) {
  const pairs = Object.entries(props).filter(([k]) => k in EVENT_NAMES)
  const added = pairs.map(([k, fn]) => {
    const type = EVENT_NAMES[k] as string
    // The handlers take structural event types the DOM events satisfy.
    const listener = fn as unknown as EventListener
    target.addEventListener(type, listener)
    return () => target.removeEventListener(type, listener)
  })
  return () => {
    for (const remove of added) remove()
  }
}

function setup(
  html = '<button type="button">Press</button>',
  platform: PlatformFlags = platforms.windows,
  extra: {
    disabled?: boolean
    longPress?: boolean | { moveTolerance: number }
    nonce?: string
    suppressTouchContextMenu?: boolean
  } = {},
) {
  detach?.()
  unsubscribe?.()
  // A press left open by a previous test must not hear this test's events.
  handle?.dispose()
  document.body.innerHTML = html
  el = document.body.firstElementChild as HTMLElement
  events = []
  const env = domEnvironment({ platform, ...(extra.nonce ? { nonce: extra.nonce } : {}) })
  unsubscribe = env.modality.subscribe(() => {})
  handle = createPress({
    env,
    send: (e) =>
      events.push(`${e.type}:${e.pointerType}${"metaKey" in e && e.metaKey ? ":meta" : ""}`),
    disabled: () => extra.disabled === true,
    ...(extra.longPress ? { longPress: extra.longPress === true ? {} : extra.longPress } : {}),
    ...(extra.suppressTouchContextMenu ? { suppressTouchContextMenu: true } : {}),
  })
  detach = attach(el, handle.props)
}

const ptr = (type: string, init: PointerEventInit = {}, target: Element = el) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerenter" && type !== "pointerleave",
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      width: 10,
      height: 10,
      pressure: 0.5,
      ...init,
    }),
  )
const click = (detail: number, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail, ...init }))
const key = (
  type: "keydown" | "keyup",
  k: string,
  init: KeyboardEventInit = {},
  target: Element = el,
) => {
  const e = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: k, ...init })
  target.dispatchEvent(e)
  return e
}

beforeEach(() => setup())
afterEach(() => {
  vi.useRealTimers()
  detach()
  unsubscribe()
  document.body.innerHTML = ""
})

describe("pointer press", () => {
  it("mouse click: START, UP, END and one PRESS; data-pressed only between press and release", () => {
    ptr("pointerdown")
    expect(handle.isPressed()).toBe(true)
    ptr("pointerup")
    expect(handle.isPressed()).toBe(false)
    click(1)
    expect(events).toEqual([
      "PRESS.START:mouse",
      "PRESS.UP:mouse",
      "PRESS.END:mouse",
      "PRESS:mouse",
    ])
  })

  it("a disabled part sends nothing, for pointer, keyboard and AT", () => {
    setup(undefined, undefined, { disabled: true })
    ptr("pointerdown")
    ptr("pointerup")
    click(1)
    key("keydown", "Enter")
    key("keyup", "Enter")
    click(0)
    expect(events).toEqual([])
  })

  it("press moved off the target and released outside: START and END, no PRESS", () => {
    ptr("pointerdown")
    ptr("pointerleave")
    expect(handle.isPressed()).toBe(false)
    ptr("pointerup")
    expect(events).toEqual(["PRESS.START:mouse", "PRESS.END:mouse"])
  })

  it("returning over the target before release restores data-pressed and activates", () => {
    ptr("pointerdown")
    ptr("pointerleave")
    ptr("pointerenter")
    expect(handle.isPressed()).toBe(true)
    ptr("pointerup")
    click(1)
    expect(events.at(-1)).toBe("PRESS:mouse")
  })

  it("a touch press turned into a scroll: PRESS.CANCEL, no PRESS", () => {
    ptr("pointerdown", { pointerType: "touch" })
    ptr("pointercancel", { pointerType: "touch" })
    expect(events).toEqual(["PRESS.START:touch", "PRESS.CANCEL:touch"])
  })

  it("leaving a touched button removes data-pressed and releasing does not activate", () => {
    ptr("pointerdown", { pointerType: "touch" })
    ptr("pointerleave", { pointerType: "touch" })
    expect(handle.isPressed()).toBe(false)
    ptr("pointerup", { pointerType: "touch" })
    expect(events).not.toContain("PRESS:touch")
  })
})

describe("blur during a pointer press", () => {
  it("focus moving to an ancestor (WebKit's mousedown on a focused button) does not cancel it", () => {
    setup('<div tabindex="-1" id="box"><button type="button">Done</button></div>')
    const box = el
    const button = box.querySelector("button") as HTMLButtonElement
    detach()
    el = button
    detach = attach(el, handle.props)
    button.focus()
    ptr("pointerdown")
    box.focus()
    ptr("pointerup")
    click(1)
    expect(events).toContain("PRESS:mouse")
  })

  it("focus leaving elsewhere cancels it", () => {
    setup('<div><button type="button">Done</button><input aria-label="Other" /></div>')
    const button = el.querySelector("button") as HTMLButtonElement
    const other = el.querySelector("input") as HTMLInputElement
    detach()
    el = button
    detach = attach(el, handle.props)
    button.focus()
    ptr("pointerdown")
    other.focus()
    ptr("pointerup")
    click(1)
    expect(events).toContain("PRESS.CANCEL:mouse")
    expect(events).not.toContain("PRESS:mouse")
  })
})

describe("activation bound to click", () => {
  it("a bare click (ZG#1664, BITS#2185): START, END, one PRESS, all virtual, synchronously", () => {
    click(0)
    expect(events).toEqual(["PRESS.START:virtual", "PRESS.END:virtual", "PRESS:virtual"])
  })

  it("no click after pointerup (DOM replaced, RA#1513): the fallback delivers exactly one PRESS", () => {
    vi.useFakeTimers()
    setup()
    ptr("pointerdown")
    ptr("pointerup")
    expect(events).not.toContain("PRESS:mouse")
    vi.advanceTimersByTime(32)
    // A late click for the same press is not a second activation.
    click(1)
    expect(events.filter((e) => e === "PRESS:mouse")).toHaveLength(1)
  })

  it("VO+Space on a native button with role=menuitem fires two clicks: one PRESS (WebKit 228318)", () => {
    vi.useFakeTimers()
    setup('<button type="button" role="menuitem">Item</button>', platforms.apple)
    click(0)
    click(0)
    expect(events.filter((e) => e === "PRESS:virtual")).toHaveLength(1)
  })

  it("macOS Control+click asks for the context menu and never presses", () => {
    setup(undefined, platforms.apple)
    ptr("pointerdown", { ctrlKey: true })
    expect(events).toEqual(["CONTEXT_MENU:mouse"])
  })
})

describe("keyboard activation", () => {
  it("held Space with key repeats: exactly one PRESS, on keyup", () => {
    key("keydown", " ")
    key("keydown", " ", { repeat: true })
    key("keydown", " ", { repeat: true })
    expect(events).toEqual(["PRESS.START:keyboard"])
    key("keyup", " ")
    expect(events).toEqual([
      "PRESS.START:keyboard",
      "PRESS.UP:keyboard",
      "PRESS.END:keyboard",
      "PRESS:keyboard",
    ])
  })

  it("Enter on a native button: one PRESS, the native synthetic click is prevented", () => {
    const down = key("keydown", "Enter")
    expect(down.defaultPrevented).toBe(true)
    key("keyup", "Enter")
    expect(events.filter((e) => e === "PRESS:keyboard")).toHaveLength(1)
  })

  it("Space on a link does nothing; Enter on a link presses through its native click", () => {
    setup('<a href="#x">Link</a>')
    key("keydown", " ")
    key("keyup", " ")
    expect(events).toEqual([])
    const down = key("keydown", "Enter")
    expect(down.defaultPrevented).toBe(false)
    click(0)
    key("keyup", "Enter")
    expect(events.filter((e) => e === "PRESS:keyboard")).toHaveLength(1)
  })

  it("Enter and Space in a text field never press", () => {
    setup('<input type="text">')
    key("keydown", "Enter")
    key("keyup", "Enter")
    key("keydown", " ")
    key("keyup", " ")
    expect(events).toEqual([])
  })

  it("a native checkbox presses on Space only", () => {
    setup('<input type="checkbox">')
    key("keydown", "Enter")
    key("keyup", "Enter")
    expect(events).toEqual([])
    key("keydown", " ")
    key("keyup", " ")
    expect(events.at(-1)).toBe("PRESS:keyboard")
  })

  it('a <button role="checkbox"> presses on Space, not Enter; Enter is prevented (no native click)', () => {
    setup('<button type="button" role="checkbox" aria-checked="false">c</button>')
    const enter = key("keydown", "Enter")
    key("keyup", "Enter")
    expect(enter.defaultPrevented).toBe(true)
    expect(events).toEqual([])
    key("keydown", " ")
    key("keyup", " ")
    expect(events.at(-1)).toBe("PRESS:keyboard")
  })

  it("Enter on a native <input type=checkbox> is not prevented (implicit submission)", () => {
    setup('<input type="checkbox">')
    expect(key("keydown", "Enter").defaultPrevented).toBe(false)
  })
})

describe("lost keyup while ⌘ is held (Chromium 1393524, WebKit 55291, Mozilla 1299553)", () => {
  it("on macOS, ⌘'s keyup ends the Space press with metaKey", () => {
    setup(undefined, platforms.apple)
    key("keydown", "Meta", { metaKey: true })
    key("keydown", " ", { metaKey: true })
    expect(handle.isPressed()).toBe(true)
    // The browser never fires Space's keyup; ⌘ is released.
    key("keyup", "Meta")
    expect(handle.isPressed()).toBe(false)
    expect(events.at(-1)).toBe("PRESS:keyboard:meta")
  })

  it("elsewhere the press waits for its own keyup", () => {
    setup(undefined, platforms.windows)
    key("keydown", " ", { metaKey: true })
    key("keyup", "Meta")
    expect(handle.isPressed()).toBe(true)
  })
})

describe("touch behaviour", () => {
  it("injects touch-action pan-x pan-y pinch-zoom once per document, with the nonce, never manipulation", () => {
    setup(undefined, platforms.ios, { nonce: "abc" })
    ptr("pointerdown", { pointerType: "touch" })
    ptr("pointerup", { pointerType: "touch" })
    ptr("pointerdown", { pointerType: "touch", pointerId: 2 })
    const styles = document.head.querySelectorAll('style[data-rind-style="touch-action"]')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain("touch-action: pan-x pan-y pinch-zoom")
    expect(styles[0]?.textContent).not.toContain("manipulation")
    // Browsers hide the nonce attribute once inserted; the property keeps it.
    const style = styles[0] as HTMLStyleElement
    expect(style.nonce || style.getAttribute("nonce")).toBe("abc")
  })

  // jsdom has no -webkit-user-select; real browsers run this.
  it.runIf(!navigator.userAgent.includes("jsdom"))(
    "iOS: overlapping touch presses restore the document's user-select exactly once",
    () => {
      vi.useFakeTimers()
      document.documentElement.style.setProperty("-webkit-user-select", "text")
      setup('<button type="button">a</button>', platforms.ios)
      const second = document.createElement("button")
      document.body.append(second)
      const other = createPress({
        env: domEnvironment({ platform: platforms.ios }),
        send: () => {},
      })
      const detachOther = attach(second, other.props)
      const root = document.documentElement.style
      const set = vi.spyOn(root, "setProperty")
      ptr("pointerdown", { pointerType: "touch" })
      ptr("pointerdown", { pointerType: "touch", pointerId: 2 }, second)
      ptr("pointerup", { pointerType: "touch" })
      vi.advanceTimersByTime(300)
      ptr("pointerup", { pointerType: "touch", pointerId: 2 }, second)
      vi.advanceTimersByTime(300)
      const restores = set.mock.calls.filter(([, v]) => v === "text")
      expect(restores).toHaveLength(1)
      expect(root.getPropertyValue("-webkit-user-select")).toBe("text")
      detachOther()
      root.removeProperty("-webkit-user-select")
    },
  )
})

describe("long press", () => {
  it("after 500 ms on fake timers: LONG_PRESS, no PRESS, and no context menu", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    vi.advanceTimersByTime(500)
    expect(events).toContain("LONG_PRESS:touch")
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    el.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    ptr("pointerup", { pointerType: "touch" })
    click(1)
    vi.advanceTimersByTime(100)
    expect(events).not.toContain("PRESS:touch")
  })

  it("moving past the tolerance cancels it; jitter within it does not", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: { moveTolerance: 10 } })
    ptr("pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 })
    ptr("pointermove", { pointerType: "touch", clientX: 14, clientY: 10 }, document.body)
    vi.advanceTimersByTime(500)
    expect(events).toContain("LONG_PRESS:touch")
    ptr("pointerup", { pointerType: "touch" })
    events = []
    ptr("pointerdown", { pointerType: "touch", clientX: 10, clientY: 10 })
    ptr("pointermove", { pointerType: "touch", clientX: 25, clientY: 10 }, document.body)
    vi.advanceTimersByTime(500)
    expect(events).not.toContain("LONG_PRESS:touch")
  })

  it("the platform callout is suppressed during the touch press only", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.ios, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    expect(el.hasAttribute("data-rind-long-pressing")).toBe(true)
    // An inline style (CSSOM, CSP-safe), never an injected rule.
    expect(document.head.innerHTML).not.toContain("touch-callout")
    const supported = CSS.supports?.("-webkit-touch-callout", "none") === true
    if (supported) expect(el.style.getPropertyValue("-webkit-touch-callout")).toBe("none")
    ptr("pointerup", { pointerType: "touch" })
    expect(el.hasAttribute("data-rind-long-pressing")).toBe(false)
    expect(el.style.getPropertyValue("-webkit-touch-callout")).toBe("")
  })

  it("a second pointer going down cancels it (a pinch)", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    ptr("pointerdown", { pointerType: "touch", pointerId: 2 }, document.body)
    vi.advanceTimersByTime(500)
    expect(events).not.toContain("LONG_PRESS:touch")
  })

  it("released before the threshold: an ordinary PRESS", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    vi.advanceTimersByTime(200)
    ptr("pointerup", { pointerType: "touch" })
    click(1)
    expect(events).toContain("PRESS:touch")
    expect(events).not.toContain("LONG_PRESS:touch")
  })
})

describe("review round 1", () => {
  it("a mouse released outside ends the press; re-entering with no button does not re-press", () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="out">out</div>')
    const out = document.getElementById("out") as HTMLElement
    ptr("pointerdown")
    ptr("pointerleave")
    ptr("pointerup", {}, out)
    expect(handle.isPressed()).toBe(false)
    expect(events).toEqual(["PRESS.START:mouse", "PRESS.END:mouse"])
    ptr("pointerenter", { buttons: 0 })
    expect(handle.isPressed()).toBe(false)
    events.length = 0
    ptr("pointerdown")
    ptr("pointerup")
    click(1)
    expect(events).toEqual([
      "PRESS.START:mouse",
      "PRESS.UP:mouse",
      "PRESS.END:mouse",
      "PRESS:mouse",
    ])
  })

  it("a touch starting on a child releases the child's implicit capture", () => {
    setup('<button type="button"><span>Press</span></button>')
    const span = el.querySelector("span") as HTMLSpanElement & {
      hasPointerCapture(id: number): boolean
      releasePointerCapture(id: number): void
    }
    const release = vi.fn()
    span.hasPointerCapture = () => true
    span.releasePointerCapture = release
    ptr("pointerdown", { pointerType: "touch", pointerId: 7 }, span)
    expect(release).toHaveBeenCalledWith(7)
  })

  it("a long touch with no trailing click does not swallow the next AT click or context menu", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    vi.advanceTimersByTime(500)
    ptr("pointerup", { pointerType: "touch" })
    vi.advanceTimersByTime(1000)
    events.length = 0
    click(0)
    expect(events).toEqual(["PRESS.START:virtual", "PRESS.END:virtual", "PRESS:virtual"])
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    el.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(false)
  })

  it("the trailing click right after a long touch is still not an activation", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { longPress: true })
    ptr("pointerdown", { pointerType: "touch" })
    vi.advanceTimersByTime(500)
    ptr("pointerup", { pointerType: "touch" })
    click(1)
    expect(events.filter((e) => e.startsWith("PRESS:"))).toEqual([])
  })
})

describe("R2.1: a press ends on focus loss or a hidden document (react-spectrum#6094)", () => {
  let visibility: DocumentVisibilityState = "visible"
  const setVisibility = (v: DocumentVisibilityState) => {
    visibility = v
    document.dispatchEvent(new Event("visibilitychange"))
  }
  beforeEach(() => {
    visibility = "visible"
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    })
  })
  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState")
  })

  it("Enter on a link-like part, then the document is hidden: START, CANCEL, no PRESS", () => {
    setup('<span role="link" tabindex="0">Docs</span>')
    el.focus()
    key("keydown", "Enter")
    setVisibility("hidden")
    expect(events).toEqual(["PRESS.START:keyboard", "PRESS.CANCEL:keyboard"])
    expect(handle.isPressed()).toBe(false)
    // The keyup never arrives here; if it did, it would not press.
    key("keyup", "Enter")
    expect(events.filter((e) => e.startsWith("PRESS:"))).toEqual([])
  })

  it("focus moves away during a held Space: CANCEL, and the release presses nothing", () => {
    setup('<button type="button">Save</button><button type="button" id="other">Other</button>')
    el.focus()
    key("keydown", " ")
    expect(handle.isPressed()).toBe(true)
    ;(document.getElementById("other") as HTMLElement).focus()
    expect(events).toEqual(["PRESS.START:keyboard", "PRESS.CANCEL:keyboard"])
    expect(handle.isPressed()).toBe(false)
    key("keyup", " ", {}, document.getElementById("other") as HTMLElement)
    expect(events.filter((e) => e.startsWith("PRESS:"))).toEqual([])
  })

  it("a touch press, then the tab is hidden: CANCEL; the late pointerup and click press nothing", async () => {
    ptr("pointerdown", { pointerType: "touch" })
    setVisibility("hidden")
    expect(events).toEqual(["PRESS.START:touch", "PRESS.CANCEL:touch"])
    expect(handle.isPressed()).toBe(false)
    setVisibility("visible")
    ptr("pointerup", { pointerType: "touch" })
    click(1)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    expect(events.filter((e) => e.startsWith("PRESS:"))).toEqual([])
  })

  it("a normal press afterwards works again", async () => {
    ptr("pointerdown", { pointerType: "touch" })
    setVisibility("hidden")
    setVisibility("visible")
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    events.length = 0
    ptr("pointerdown")
    ptr("pointerup")
    click(1)
    expect(events).toEqual([
      "PRESS.START:mouse",
      "PRESS.UP:mouse",
      "PRESS.END:mouse",
      "PRESS:mouse",
    ])
  })
})

describe("R2.3: touch context menu suppression without long press", () => {
  const contextMenu = () => {
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e
  }

  it("an 800 ms touch hold on a stepper: contextmenu prevented, no LONG_PRESS, a normal press on release", () => {
    vi.useFakeTimers()
    setup(undefined, platforms.android, { suppressTouchContextMenu: true })
    ptr("pointerdown", { pointerType: "touch" })
    vi.advanceTimersByTime(800)
    expect(contextMenu().defaultPrevented).toBe(true)
    ptr("pointerup", { pointerType: "touch" })
    click(1)
    expect(events).toEqual([
      "PRESS.START:touch",
      "PRESS.UP:touch",
      "PRESS.END:touch",
      "PRESS:touch",
    ])
  })

  it("a mouse right-click on the same part is not prevented", () => {
    setup(undefined, platforms.windows, { suppressTouchContextMenu: true })
    ptr("pointerdown", { button: 2 })
    expect(contextMenu().defaultPrevented).toBe(false)
  })

  it("without the option a touch hold leaves the context menu alone", () => {
    setup(undefined, platforms.android)
    ptr("pointerdown", { pointerType: "touch" })
    expect(contextMenu().defaultPrevented).toBe(false)
  })
})
