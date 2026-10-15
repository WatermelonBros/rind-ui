import { describe, expect, it } from "vitest"
import { RESETS, resetRindGlobals } from "./setup"

const inBrowser = !navigator.userAgent.includes("jsdom")
const isNative = (fn: unknown) => typeof fn === "function" && /\[native code\]/.test(String(fn))

describe("@rind-ui/testing/setup", () => {
  it.runIf(!inBrowser)("installs what jsdom lacks", () => {
    expect(typeof ResizeObserver).toBe("function")
    expect(typeof IntersectionObserver).toBe("function")
    expect(typeof Element.prototype.scrollIntoView).toBe("function")
    expect(document.createElement("div").getAnimations()).toEqual([])
    expect(typeof PointerEvent).toBe("function")
    expect(typeof window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe("boolean")
    expect(window.visualViewport?.width).toBe(window.innerWidth)
    expect(document.createElement("div").hasPointerCapture(1)).toBe(false)
  })

  it.runIf(!inBrowser)("does not fake layout or focus", () => {
    const div = document.createElement("div")
    document.body.append(div)
    // jsdom's own behaviour, untouched: no layout, and a plain div is not focusable.
    expect(div.getBoundingClientRect().width).toBe(0)
    div.focus()
    expect(document.activeElement).not.toBe(div)
    div.remove()
  })

  it.runIf(inBrowser)("replaces no native API in a real browser", () => {
    for (const fn of [
      globalThis.ResizeObserver,
      globalThis.IntersectionObserver,
      globalThis.PointerEvent,
      window.matchMedia,
      Element.prototype.scrollIntoView,
      Element.prototype.getAnimations,
      Element.prototype.setPointerCapture,
    ]) {
      expect(isNative(fn)).toBe(true)
    }
  })

  describe("document-level state does not leak", () => {
    let state: string | null = null
    const resets: Set<() => void> = Reflect.get(globalThis, RESETS) ?? new Set()
    Reflect.set(globalThis, RESETS, resets)
    resets.add(() => {
      state = null
    })

    it("a test ends with state left over", () => {
      state = "open layer"
      expect(state).toBe("open layer")
    })

    it("the next test starts clean", () => {
      expect(state).toBeNull()
    })

    it("the reset is exported for other runners", () => {
      state = "x"
      resetRindGlobals()
      expect(state).toBeNull()
    })
  })
})
