// The modality tracker against the event sequences browsers and assistive technology
// actually produce (accessibility.md §3, AT note root cause A).
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ModalitySource, PlatformFlags } from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import { modalityTracker } from "./modality"
import { platforms } from "./platform"

let tracker: ModalitySource
let unsubscribe: () => void
let button: HTMLButtonElement
let input: HTMLInputElement

function setup(platform: PlatformFlags = platforms.windows) {
  unsubscribe?.()
  tracker = modalityTracker(
    () => document,
    () => platform,
  )
  unsubscribe = tracker.subscribe(() => {})
}

beforeEach(() => {
  document.body.innerHTML =
    '<button id="b">Open</button><input id="i" type="text"><button id="o">Other</button>'
  button = document.getElementById("b") as HTMLButtonElement
  input = document.getElementById("i") as HTMLInputElement
  setup()
})
afterEach(() => {
  unsubscribe()
  document.body.innerHTML = ""
})

const pointer = (el: Element, init: PointerEventInit = {}) =>
  el.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "mouse",
      width: 10,
      height: 10,
      pressure: 0.5,
      ...init,
    }),
  )
const key = (el: Element, init: KeyboardEventInit) => {
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }))
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, ...init }))
}
const click = (el: Element, detail: number) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }))

describe("modality tracking", () => {
  it("pointer then keyboard", () => {
    pointer(button)
    expect(tracker.modality()).toBe("pointer")
    key(button, { key: "ArrowDown" })
    expect(tracker.modality()).toBe("keyboard")
  })

  it("touch sets touch", () => {
    pointer(button, { pointerType: "touch" })
    expect(tracker.modality()).toBe("touch")
  })

  it("⌘+Tab and a lone Control do not count as keyboard", () => {
    pointer(button)
    key(document.body, { key: "Tab", metaKey: true })
    key(document.body, { key: "Control", ctrlKey: true })
    expect(tracker.modality()).toBe("pointer")
  })

  it("Alt+key counts on Apple (Option types characters), not elsewhere", () => {
    pointer(button)
    key(button, { key: "x", altKey: true })
    expect(tracker.modality()).toBe("pointer")
    setup(platforms.apple)
    pointer(button)
    key(button, { key: "x", altKey: true })
    expect(tracker.modality()).toBe("keyboard")
  })

  it("subscribers hear every change", () => {
    const seen: string[] = []
    const off = tracker.subscribe((m) => seen.push(m))
    pointer(button)
    key(button, { key: "a" })
    off()
    expect(seen).toEqual(["pointer", "keyboard"])
  })
})

describe("virtual input (assistive technology)", () => {
  it("VoiceOver VO+Space in Safari: mousedown, mouseup, click detail 0, no pointer events (RX#1963)", () => {
    pointer(button)
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, detail: 0 }))
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, detail: 0 }))
    click(document.getElementById("o") as Element, 0)
    expect(tracker.modality()).toBe("virtual")
  })

  it("NVDA browse-mode Enter in Firefox: only a click with detail 0 (RX#2700)", () => {
    click(button, 0)
    expect(tracker.modality()).toBe("virtual")
  })

  it("a keyboard Enter's synthetic click (detail 0, after keydown on the same element) stays keyboard", () => {
    key(button, { key: "Enter" })
    click(button, 0)
    expect(tracker.modality()).toBe("keyboard")
  })

  it("an empty pointerType is virtual", () => {
    pointer(button, { pointerType: "" })
    expect(tracker.modality()).toBe("virtual")
  })

  it("iOS VoiceOver zero-size pointer events are virtual, not touch (WebKit 222627, 223202)", () => {
    setup(platforms.ios)
    pointer(button, { pointerType: "touch", width: 0, height: 0 })
    expect(tracker.modality()).toBe("virtual")
  })

  it("Chromium AT clicks: 1×1, zero pressure, detail 0 mouse pointer (RA#10310)", () => {
    setup(platforms.windows)
    pointer(button, { width: 1, height: 1, pressure: 0 })
    expect(tracker.modality()).toBe("virtual")
  })

  it("a focus with no preceding key or pointer event is virtual (RX#1047)", () => {
    pointer(button)
    // The pointer's focus is consumed; then the screen-reader cursor moves focus.
    button.focus()
    input.focus()
    expect(tracker.modality()).toBe("virtual")
    expect(tracker.focusCause(input)).toBe("other")
  })

  it("the window regaining focus does not change the modality", () => {
    pointer(button)
    button.focus()
    window.dispatchEvent(new FocusEvent("blur"))
    button.blur()
    button.focus()
    expect(tracker.modality()).toBe("pointer")
    expect(tracker.focusCause(button)).toBe("window")
  })
})

describe("text-input rule", () => {
  it("typing after a click keeps pointer; Tab and Escape switch to keyboard", () => {
    pointer(input)
    input.focus()
    key(input, { key: "a" })
    key(input, { key: "b" })
    expect(tracker.modality()).toBe("pointer")
    key(input, { key: "Escape" })
    expect(tracker.modality()).toBe("keyboard")
  })
})

describe("focus cause (A.1)", () => {
  it("rind-ui's own move keeps the modality and has its cause", async () => {
    key(button, { key: "Enter" })
    await focusSafely(input, { modality: tracker }, "layer")
    expect(tracker.modality()).toBe("keyboard")
    expect(tracker.focusCause(input)).toBe("layer")
  })

  it("Tab into an element: cause key", () => {
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }))
    input.focus()
    expect(tracker.focusCause(input)).toBe("key")
    expect(tracker.modality()).toBe("keyboard")
  })

  it("pointer focus: cause pointer", () => {
    pointer(input)
    input.focus()
    expect(tracker.focusCause(input)).toBe("pointer")
  })

  it("consumer focus(): cause other and virtual", () => {
    input.focus()
    expect(tracker.focusCause(input)).toBe("other")
    expect(tracker.modality()).toBe("virtual")
  })
})

describe("review round 1", () => {
  it("window refocus with nothing focused: the next AT focus is virtual, not window (RX#1047)", () => {
    window.dispatchEvent(new FocusEvent("blur"))
    window.dispatchEvent(new FocusEvent("focus"))
    button.focus()
    expect(tracker.focusCause(button)).toBe("other")
    expect(tracker.modality()).toBe("virtual")
  })

  it("combobox: navigation keys after a click set keyboard; letters do not", () => {
    input.setAttribute("role", "combobox")
    pointer(input)
    input.focus()
    key(input, { key: "a" })
    expect(tracker.modality()).toBe("pointer")
    key(input, { key: "ArrowDown" })
    expect(tracker.modality()).toBe("keyboard")
  })

  it("a stray second unsubscribe does not remove another subscriber's tracker", () => {
    const extra = tracker.subscribe(() => {})
    extra()
    extra()
    pointer(button)
    expect(tracker.modality()).toBe("pointer")
  })
})
