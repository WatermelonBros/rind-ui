import { afterEach, describe, expect, it, vi } from "vitest"
import { getLayerStack, type LayerOptions, layerId } from "./layer-stack"
import { platforms } from "./platform"
import { quirkActive } from "./quirks"
import { lockScroll, lockScrollForModals } from "./scroll-lock"

const inBrowser = !navigator.userAgent.includes("jsdom")
const html = document.documentElement
const ATTR = "data-rind-scroll-locked"
const WIDTH_VAR = "--rind-scrollbar-width"

afterEach(() => {
  vi.restoreAllMocks()
  html.removeAttribute("style")
  html.removeAttribute(ATTR)
  document.body.removeAttribute("style")
  document.body.innerHTML = ""
  window.scrollTo(0, 0)
})

const div = (parent: Element = document.body, height?: string) => {
  const el = document.createElement("div")
  if (height) el.style.height = height
  parent.append(el)
  return el
}

/** A page tall enough to scroll, so a classic scrollbar may exist. */
const tallPage = () => div(document.body, "5000px")

const stack = () => getLayerStack(document)
const modal = (id: string, el: Element, extra: Partial<LayerOptions> = {}) =>
  stack().push({
    id: layerId(id),
    kind: "dialog",
    modal: true,
    elements: () => [el],
    ...extra,
  })

const locked = () => html.hasAttribute(ATTR) && html.style.overflow === "hidden"
const barWidth = () => window.innerWidth - html.clientWidth

describe("reference counting by modal layers", () => {
  it("stays locked until the parent of a nested modal closes too", () => {
    lockScrollForModals(document)
    const a = modal("m1", div())
    const b = modal("m2", div(), { parent: layerId("m1") })
    expect(locked()).toBe(true)
    b.release()
    expect(locked()).toBe(true)
    a.release()
    expect(locked()).toBe(false)
    expect(html.hasAttribute(ATTR)).toBe(false)
  })

  it("does not lock for a non-modal layer", () => {
    lockScrollForModals(document)
    stack().push({
      id: layerId("p"),
      kind: "popover",
      modal: false,
      elements: () => [div()],
    })
    expect(html.hasAttribute(ATTR)).toBe(false)
    expect(html.style.overflow).toBe("")
  })

  it("is one lock for two lockScroll callers", () => {
    const a = lockScroll(document)
    const b = lockScroll(document)
    a()
    expect(locked()).toBe(true)
    b()
    expect(locked()).toBe(false)
  })

  it("gives modal layers' elements overscroll-behavior: contain, restored on close", () => {
    lockScrollForModals(document)
    const el = div()
    el.style.overscrollBehavior = "auto"
    const handle = modal("m1", el)
    expect(el.style.overscrollBehavior).toBe("contain")
    handle.release()
    expect(el.style.overscrollBehavior).toBe("auto")
  })
})

describe("the right scroller", () => {
  it.runIf(inBrowser)("locks body when html clips and body scrolls (app shell)", () => {
    html.style.overflow = "hidden"
    document.body.style.overflowY = "auto"
    document.body.style.height = "100vh"
    lockScrollForModals(document)
    const handle = modal("m1", div())
    expect(document.body.style.overflow).toBe("hidden")
    expect(document.body.hasAttribute(ATTR)).toBe(true)
    expect(html.hasAttribute(ATTR)).toBe(false)
    handle.release()
    expect(document.body.hasAttribute(ATTR)).toBe(false)
    expect(html.style.overflow).toBe("hidden")
  })

  // BUG (implementation): the lock snapshots and restores the `overflow` shorthand, so an
  // author's inline `overflow-y: auto` is removed on release instead of restored.
  it.runIf(inBrowser)("restores the body's own overflow-y after release", () => {
    html.style.overflow = "hidden"
    document.body.style.overflowY = "auto"
    lockScrollForModals(document)
    modal("m1", div()).release()
    expect(document.body.style.overflowY).toBe("auto")
  })
})

describe("no layout shift", () => {
  it.runIf(inBrowser)(
    "pads by the scrollbar width, or adds nothing with overlay scrollbars",
    () => {
      tallPage()
      const content = div()
      content.style.height = "10px"
      const before = barWidth()
      const rect = content.getBoundingClientRect()
      const release = lockScroll(document)
      const after = content.getBoundingClientRect()
      expect(html.style.getPropertyValue(WIDTH_VAR)).toBe(`${before}px`)
      if (before > 0) expect(html.style.paddingRight).toBe(`${before}px`)
      else expect(html.style.paddingRight).toBe("")
      expect(after.left).toBe(rect.left)
      expect(after.width).toBe(rect.width)
      release()
      expect(html.style.paddingRight).toBe("")
    },
  )

  it.runIf(inBrowser && CSS.supports("scrollbar-gutter", "stable"))(
    "adds no padding with scrollbar-gutter: stable, and never sets scrollbar-gutter",
    () => {
      tallPage()
      html.style.setProperty("scrollbar-gutter", "stable")
      const release = lockScroll(document)
      expect(html.style.paddingRight).toBe("")
      expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("stable")
      release()
      expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("stable")
    },
  )

  it("never sets scrollbar-gutter itself", () => {
    tallPage()
    const release = lockScroll(document)
    expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("")
    release()
  })

  it("carries data-rind-scroll-locked only while locked", () => {
    const release = lockScroll(document)
    expect(html.hasAttribute(ATTR)).toBe(true)
    release()
    expect(html.hasAttribute(ATTR)).toBe(false)
  })
})

describe("exact restore", () => {
  it("restores pre-existing inline values and priorities", () => {
    html.style.setProperty("overflow", "scroll", "important")
    html.style.setProperty("padding-right", "3px")
    html.style.setProperty(WIDTH_VAR, "7px", "important")
    const release = lockScroll(document)
    expect(html.style.overflow).toBe("hidden")
    release()
    expect(html.style.getPropertyValue("overflow")).toBe("scroll")
    expect(html.style.getPropertyPriority("overflow")).toBe("important")
    expect(html.style.getPropertyValue("padding-right")).toBe("3px")
    expect(html.style.getPropertyPriority("padding-right")).toBe("")
    expect(html.style.getPropertyValue(WIDTH_VAR)).toBe("7px")
    expect(html.style.getPropertyPriority(WIDTH_VAR)).toBe("important")
  })

  it("restores a pre-existing data-rind-scroll-locked attribute", () => {
    html.setAttribute(ATTR, "custom")
    lockScroll(document)()
    expect(html.getAttribute(ATTR)).toBe("custom")
  })

  it("unlocks when a modal opens and closes in one task", () => {
    lockScrollForModals(document)
    modal("m1", div()).release()
    expect(html.hasAttribute(ATTR)).toBe(false)
    expect(html.style.overflow).toBe("")
  })

  it("stays locked when one modal closes and another opens in the same handler", () => {
    lockScrollForModals(document)
    const first = modal("m1", div())
    first.release()
    const second = modal("m2", div())
    expect(locked()).toBe(true)
    second.release()
    expect(locked()).toBe(false)
  })

  it("restores everything when the owner releases without closing anything else", () => {
    html.style.overflow = "auto"
    lockScrollForModals(document)
    const handle = modal("m1", div())
    expect(locked()).toBe(true)
    handle.release()
    expect(html.style.overflow).toBe("auto")
    expect(html.style.getPropertyValue(WIDTH_VAR)).toBe("")
    expect(html.style.paddingRight).toBe("")
    expect(html.hasAttribute(ATTR)).toBe(false)
  })

  it("keeps the page locked when a third party clears overflow, and restores its value", async () => {
    html.style.overflow = "auto"
    const release = lockScroll(document)
    html.style.overflow = ""
    await Promise.resolve()
    expect(html.style.overflow).toBe("hidden")
    release()
    expect(html.style.overflow).toBe("")
  })

  it.runIf(inBrowser)("does not change scrollY with scroll-behavior: smooth", () => {
    tallPage()
    html.style.scrollBehavior = "smooth"
    window.scrollTo({ top: 1000, behavior: "instant" })
    const y = window.scrollY
    expect(y).toBeGreaterThan(0)
    const release = lockScroll(document)
    expect(window.scrollY).toBe(y)
    release()
    expect(window.scrollY).toBe(y)
  })
})

describe("CSP-safe", () => {
  it("adds no <style> element", () => {
    const count = document.querySelectorAll("style").length
    lockScrollForModals(document)
    const handle = modal("m1", div())
    expect(document.querySelectorAll("style").length).toBe(count)
    handle.release()
    expect(document.querySelectorAll("style").length).toBe(count)
  })
})

describe("listeners", () => {
  const listenerTypes = (platform: (typeof platforms)[keyof typeof platforms]) => {
    const spy = vi.spyOn(document, "addEventListener")
    lockScroll(document, platform)()
    const types = spy.mock.calls.map(([type]) => type)
    spy.mockRestore()
    return types
  }

  it("adds no wheel or touch listeners on desktop", () => {
    const types = listenerTypes(platforms.windows)
    expect(types).not.toContain("wheel")
    expect(types).not.toContain("touchmove")
  })

  it("adds a touchmove listener on iOS only", () => {
    expect(quirkActive("ios-overflow-hidden-scroll", { platform: platforms.ios })).toBe(true)
    expect(quirkActive("ios-overflow-hidden-scroll", { platform: platforms.apple })).toBe(false)
    expect(listenerTypes(platforms.ios)).toContain("touchmove")
    expect(listenerTypes(platforms.apple)).not.toContain("touchmove")
  })
})

// Only Chromium lets scripts construct Touch (WebKit exposes the class but throws "Illegal
// constructor"; Firefox desktop has neither); the policy itself is engine-neutral.
const canConstructTouch = () => {
  try {
    new Touch({ identifier: 1, target: document.body })
    return typeof TouchEvent !== "undefined"
  } catch {
    return false
  }
}
describe.runIf(inBrowser && typeof Touch !== "undefined" && canConstructTouch())(
  "iOS touch policy",
  () => {
    const touch = (target: Element, id = 1, x = 50, y = 50) =>
      new Touch({ identifier: id, target, clientX: x, clientY: y })
    const fire = (type: string, target: Element, touches: Touch[]) => {
      const event = new TouchEvent(type, {
        touches,
        changedTouches: touches,
        bubbles: true,
        cancelable: true,
      })
      target.dispatchEvent(event)
      return event
    }
    /** One-finger swipe from (50,50) by dy; returns the touchmove. */
    const swipe = (target: Element, dy: number, fingers = 1) => {
      const start = [touch(target)]
      if (fingers > 1) start.push(touch(target, 2, 70, 50))
      fire("touchstart", target, start)
      const move = [touch(target, 1, 50, 50 + dy)]
      if (fingers > 1) move.push(touch(target, 2, 70, 50 + dy))
      return fire("touchmove", target, move)
    }

    function setup() {
      tallPage()
      const behind = div()
      const dialog = div()
      dialog.style.cssText = "position:fixed;top:0;left:0;width:200px;height:100px;overflow-y:auto"
      const filler = div(dialog, "500px")
      const range = document.createElement("input")
      range.type = "range"
      dialog.append(range)
      lockScrollForModals(document, platforms.ios)
      modal("m1", dialog)
      return { behind, dialog, filler, range }
    }

    it("prevents a one-finger move that starts on the page behind", () => {
      const { behind } = setup()
      expect(swipe(behind, -30).defaultPrevented).toBe(true)
    })

    it("allows a two-finger move", () => {
      const { behind } = setup()
      expect(swipe(behind, -30, 2).defaultPrevented).toBe(false)
    })

    it("allows a move that starts on a range input", () => {
      const { range } = setup()
      expect(swipe(range, -30).defaultPrevented).toBe(false)
    })

    it("allows a move in a dialog region that can still scroll that way", () => {
      const { filler } = setup()
      expect(swipe(filler, -30).defaultPrevented).toBe(false)
    })

    it("prevents a move past the end of the dialog's content", () => {
      const { dialog, filler } = setup()
      dialog.scrollTop = dialog.scrollHeight
      expect(swipe(filler, -30).defaultPrevented).toBe(true)
    })
  },
)

describe.runIf(inBrowser && typeof Touch !== "undefined" && canConstructTouch())(
  "touch-action excludes the gesture axis (RA#9493)",
  () => {
    const move = (target: Element, dx: number, dy: number) => {
      const t = (x: number, y: number) =>
        new Touch({ identifier: 1, target, clientX: x, clientY: y })
      const init = { bubbles: true, cancelable: true }
      const start = t(50, 50)
      target.dispatchEvent(
        new TouchEvent("touchstart", { ...init, touches: [start], changedTouches: [start] }),
      )
      const end = t(50 + dx, 50 + dy)
      const event = new TouchEvent("touchmove", { ...init, touches: [end], changedTouches: [end] })
      target.dispatchEvent(event)
      return event
    }

    function setup() {
      tallPage()
      const dialog = div()
      dialog.style.cssText = "position:fixed;top:0;left:0;width:200px;height:100px"
      const slider = div(dialog, "20px")
      slider.style.touchAction = "pan-y"
      const plain = div(dialog, "20px")
      lockScrollForModals(document, platforms.ios)
      modal("m1", dialog)
      return { slider, plain }
    }

    it("leaves a horizontal move on a pan-y element to the element", () => {
      const { slider } = setup()
      expect(move(slider, 40, 0).defaultPrevented).toBe(false)
    })

    it("prevents a vertical move on it (pan-y allows it, and nothing scrolls)", () => {
      const { slider } = setup()
      expect(move(slider, 0, 40).defaultPrevented).toBe(true)
    })

    it("prevents a horizontal move on a plain element in the dialog", () => {
      const { plain } = setup()
      expect(move(plain, 40, 0).defaultPrevented).toBe(true)
    })
  },
)
