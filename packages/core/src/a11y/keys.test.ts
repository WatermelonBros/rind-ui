import { describe, expect, it } from "vitest"
import { platforms } from "../dom/platform"
import {
  isContextMenuClick,
  type KeyContext,
  type KeyDescription,
  toLogicalKey,
  toLogicalKeyEvent,
} from "./keys"

const k = (key: string, extra: Partial<KeyDescription> = {}): KeyDescription => ({
  key,
  code: "",
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  repeat: false,
  composing: false,
  ...extra,
})
const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
  dir: "ltr",
  orientation: "vertical",
  platform: platforms.windows,
  ...over,
})

describe("toLogicalKey", () => {
  // [key, orientation, ltr result, rtl result]
  const table: [string, KeyContext["orientation"], string | undefined, string | undefined][] = [
    ["ArrowDown", "vertical", "NEXT", "NEXT"],
    ["ArrowUp", "vertical", "PREV", "PREV"],
    ["ArrowRight", "vertical", "EXPAND", "COLLAPSE"],
    ["ArrowLeft", "vertical", "COLLAPSE", "EXPAND"],
    ["ArrowRight", "horizontal", "NEXT", "PREV"],
    ["ArrowLeft", "horizontal", "PREV", "NEXT"],
    ["ArrowDown", "horizontal", "EXPAND", "EXPAND"],
    ["ArrowUp", "horizontal", "COLLAPSE", "COLLAPSE"],
    ["ArrowRight", "both", "NEXT", "PREV"],
    ["ArrowLeft", "both", "PREV", "NEXT"],
    ["ArrowDown", "both", "NEXT", "NEXT"],
    ["ArrowUp", "both", "PREV", "PREV"],
    ["Home", "horizontal", "FIRST", "FIRST"],
    ["End", "horizontal", "LAST", "LAST"],
    ["PageDown", "vertical", "PAGE_NEXT", "PAGE_NEXT"],
    ["PageUp", "vertical", "PAGE_PREV", "PAGE_PREV"],
    ["Enter", "vertical", "ACTIVATE", "ACTIVATE"],
    [" ", "vertical", "ACTIVATE", "ACTIVATE"],
    ["Escape", "vertical", "DISMISS", "DISMISS"],
    ["ContextMenu", "vertical", "CONTEXT_MENU", "CONTEXT_MENU"],
    ["a", "vertical", undefined, undefined],
  ]
  for (const platform of [platforms.windows, platforms.apple]) {
    for (const [key, orientation, ltr, rtl] of table) {
      it(`${key} ${orientation} (${platform.apple ? "apple" : "windows"}): ltr ${ltr}, rtl ${rtl}`, () => {
        expect(toLogicalKey(k(key), ctx({ orientation, platform }))).toBe(ltr)
        expect(toLogicalKey(k(key), ctx({ orientation, platform, dir: "rtl" }))).toBe(rtl)
      })
    }
  }

  it("Shift+F10 is a context-menu request; F10 alone is not", () => {
    expect(toLogicalKey(k("F10", { shift: true }), ctx())).toBe("CONTEXT_MENU")
    expect(toLogicalKey(k("F10"), ctx())).toBeUndefined()
  })

  it("value controls: Up always increases; Left increases in RTL, Right in LTR", () => {
    const value = (dir: "ltr" | "rtl") => ctx({ orientation: "horizontal", value: true, dir })
    expect(toLogicalKey(k("ArrowUp"), value("ltr"))).toBe("INCREASE")
    expect(toLogicalKey(k("ArrowUp"), value("rtl"))).toBe("INCREASE")
    expect(toLogicalKey(k("ArrowRight"), value("ltr"))).toBe("INCREASE")
    expect(toLogicalKey(k("ArrowLeft"), value("rtl"))).toBe("INCREASE")
    expect(toLogicalKey(k("ArrowLeft"), value("ltr"))).toBe("DECREASE")
    expect(toLogicalKey(k("ArrowDown"), value("rtl"))).toBe("DECREASE")
    expect(toLogicalKey(k("Home"), value("rtl"))).toBe("FIRST")
  })

  it("runs in Node with no DOM", () => {
    expect(typeof document).toBe("undefined")
    expect(toLogicalKey(k("ArrowLeft"), ctx({ orientation: "horizontal", dir: "rtl" }))).toBe(
      "NEXT",
    )
  })
})

describe("platform modifier", () => {
  it("⌘+A on Apple and Control+A on Windows both have mod", () => {
    const apple = toLogicalKeyEvent(k("Home", { meta: true }), ctx({ platform: platforms.apple }))
    const windows = toLogicalKeyEvent(
      k("Home", { ctrl: true }),
      ctx({ platform: platforms.windows }),
    )
    expect(apple?.mod).toBe(true)
    expect(windows?.mod).toBe(true)
    expect(
      toLogicalKeyEvent(k("Home", { ctrl: true }), ctx({ platform: platforms.apple }))?.mod,
    ).toBe(false)
  })

  it("events carry keyboard modality and composing", () => {
    expect(toLogicalKeyEvent(k("Enter", { composing: true }), ctx())).toMatchObject({
      type: "ACTIVATE",
      modality: "keyboard",
      composing: true,
    })
  })

  it("Control+click is a context-menu request on macOS only", () => {
    expect(isContextMenuClick({ button: 0, ctrlKey: true }, platforms.apple)).toBe(true)
    expect(isContextMenuClick({ button: 0, ctrlKey: true }, platforms.windows)).toBe(false)
  })
})
