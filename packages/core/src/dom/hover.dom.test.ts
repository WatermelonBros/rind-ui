import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlatformFlags } from "../env/capabilities"
import { domEnvironment } from "../env/dom-environment"
import { createHover } from "./hover"
import { platforms } from "./platform"

let el: HTMLElement
let events: string[]
let hover: ReturnType<typeof createHover>
let detach: () => void

function setup(platform: PlatformFlags = platforms.windows) {
  detach?.()
  document.body.innerHTML = "<button>Info</button>"
  el = document.querySelector("button") as HTMLElement
  events = []
  hover = createHover({
    env: domEnvironment({ platform }),
    send: (e) => events.push(`${e.type}:${e.pointerType}`),
  })
  const enter = (e: Event) => hover.props.onPointerEnter(e as PointerEvent)
  const leave = (e: Event) => hover.props.onPointerLeave(e as PointerEvent)
  el.addEventListener("pointerenter", enter)
  el.addEventListener("pointerleave", leave)
  detach = () => {
    el.removeEventListener("pointerenter", enter)
    el.removeEventListener("pointerleave", leave)
  }
}
const ptr = (type: string, pointerType: string, target: EventTarget = el) =>
  target.dispatchEvent(new PointerEvent(type, { pointerType, bubbles: type === "pointerup" }))

beforeEach(() => setup())
afterEach(() => {
  vi.useRealTimers()
  detach()
})

describe("hover", () => {
  it("mouse and pen hover; data-hover follows", () => {
    ptr("pointerenter", "mouse")
    expect(hover.isHovered()).toBe(true)
    ptr("pointerleave", "mouse")
    ptr("pointerenter", "pen")
    expect(events).toEqual(["HOVER.START:mouse", "HOVER.END:mouse", "HOVER.START:pen"])
  })

  it("a tap never hovers", () => {
    ptr("pointerenter", "touch")
    expect(events).toEqual([])
    expect(hover.isHovered()).toBe(false)
  })

  it("iOS: the emulated mouse pointerenter right after a touch does not hover (WebKit 214609)", () => {
    vi.useFakeTimers()
    setup(platforms.ios)
    ptr("pointerenter", "mouse") // first contact installs the touch watcher
    ptr("pointerleave", "mouse")
    events.length = 0
    ptr("pointerup", "touch")
    ptr("pointerenter", "mouse")
    expect(events).toEqual([])
    vi.advanceTimersByTime(60)
    ptr("pointerenter", "mouse")
    expect(events).toEqual(["HOVER.START:mouse"])
  })
})

describe("review round 1", () => {
  it("iOS: the FIRST tap's emulated mouse pointerenter does not hover", () => {
    vi.useFakeTimers()
    setup(platforms.ios)
    ptr("pointerenter", "touch")
    ptr("pointerdown", "touch")
    ptr("pointerup", "touch")
    ptr("pointerenter", "mouse")
    expect(events).toEqual([])
    expect(hover.isHovered()).toBe(false)
  })
})
