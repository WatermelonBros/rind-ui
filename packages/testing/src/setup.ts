// `@rind-ui/testing/setup`: list it in `setupFiles` for jsdom or happy-dom. Each API is
// installed only where missing, so newer simulated DOMs and real browsers keep their own
// (in a real browser this file changes nothing). Layout and focus are deliberately not
// faked: tests that depend on them belong in browser mode.

import { installErrorLog } from "./adapters/dom"
import { installAnnouncementLog } from "./announcements"

type Writable = Record<string, unknown>

// "Missing" means no value: jsdom declares some of these keys with an undefined value.
function define(target: object | undefined, name: string, value: unknown) {
  if (!target || Reflect.get(target, name) != null) return
  Object.defineProperty(target, name, { value, configurable: true, writable: true })
}

const g = globalThis as unknown as Writable
const proto = typeof Element === "undefined" ? undefined : Element.prototype

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
// No callback is ever fired: core must not depend on a fake 0×0 entry.
define(g, "ResizeObserver", NoopObserver)
define(g, "IntersectionObserver", NoopObserver)

const noop = () => {}
define(proto, "scrollIntoView", noop)
define(proto, "scrollTo", noop)
define(proto, "scrollBy", noop)
if (typeof window !== "undefined") define(window, "scrollTo", noop)

// No running animations: presence must unmount immediately rather than wait.
define(proto, "getAnimations", () => [])
if (typeof document !== "undefined") define(document, "getAnimations", () => [])

if (typeof MouseEvent !== "undefined" && g["PointerEvent"] == null) {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly width: number
    readonly height: number
    readonly pressure: number
    readonly isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? "mouse"
      this.width = init.width ?? 1
      this.height = init.height ?? 1
      this.pressure = init.pressure ?? 0
      this.isPrimary = init.isPrimary ?? true
    }
  }
  define(g, "PointerEvent", PointerEventPolyfill)
}

define(proto, "setPointerCapture", noop)
define(proto, "releasePointerCapture", noop)
define(proto, "hasPointerCapture", () => false)

if (typeof window !== "undefined") {
  define(window, "matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  }))
  define(window, "visualViewport", {
    get width() {
      return window.innerWidth
    },
    get height() {
      return window.innerHeight
    },
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    onresize: null,
    onscroll: null,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  })
}

/**
 * Where rind-ui modules that keep document-level state (layer stack, scroll lock, focus
 * trap stack, tooltip group) register how to reset it.
 */
export const RESETS = Symbol.for("rind-ui.resets")

/** Clears every piece of rind-ui document-level state. Call after each test. */
export function resetRindGlobals(): void {
  const resets: Set<() => void> | undefined = Reflect.get(globalThis, RESETS)
  for (const reset of resets ?? []) reset()
  installAnnouncementLog().length = 0
}

// Catch errors from the very first render (before any adapter exists), and record every
// announcement.
installErrorLog()
installAnnouncementLog()

const afterEachHook = g["afterEach"]
if (typeof afterEachHook === "function") afterEachHook(resetRindGlobals)
