import { afterEach, describe, expect, it, vi } from "vitest"
import type { KeyDescription } from "../a11y/keys"
import { DEFAULT_TYPEAHEAD_TIMEOUT, matchHotkey, parseHotkey, typeaheadBuffer } from "./keyboard"
import { platforms } from "./platform"

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
const scheduler = {
  // fake-time: the fake scheduler under test (vi.useFakeTimers)
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as number),
  // fake-time: the fake scheduler under test (vi.useFakeTimers)
  requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16),
  cancelAnimationFrame: (h: unknown) => clearTimeout(h as number),
}
afterEach(() => {
  vi.useRealTimers()
})

describe("hotkeys", () => {
  it("Control+Alt+T matches macOS's key '†' through its code", () => {
    const hotkey = parseHotkey("Control+Alt+T")
    expect(
      matchHotkey(hotkey, k("†", { code: "KeyT", ctrl: true, alt: true }), platforms.apple),
    ).toBe(true)
  })

  it("mod is ⌘ on Apple and Control on Windows", () => {
    const save = parseHotkey("mod+s")
    expect(matchHotkey(save, k("s", { meta: true }), platforms.apple)).toBe(true)
    expect(matchHotkey(save, k("s", { ctrl: true }), platforms.apple)).toBe(false)
    expect(matchHotkey(save, k("s", { ctrl: true }), platforms.windows)).toBe(true)
  })

  it("never matches while composing", () => {
    expect(matchHotkey(parseHotkey("/"), k("/", { composing: true }), platforms.windows)).toBe(
      false,
    )
  })
})

describe("typeahead timing", () => {
  it("defaults to 1000 ms: a slow typist (800 ms) still builds 'ba'", () => {
    vi.useFakeTimers()
    expect(DEFAULT_TYPEAHEAD_TIMEOUT).toBe(1000)
    const buffer = typeaheadBuffer(scheduler)
    buffer.push(k("b"))
    vi.advanceTimersByTime(800)
    expect(buffer.push(k("a"))).toBe("ba")
    vi.advanceTimersByTime(1000)
    expect(buffer.search).toBe("")
  })

  it("a configured 1500 ms timeout resets after 1500 ms", () => {
    vi.useFakeTimers()
    const buffer = typeaheadBuffer(scheduler, 1500)
    buffer.push(k("x"))
    vi.advanceTimersByTime(1200)
    expect(buffer.search).toBe("x")
    vi.advanceTimersByTime(300)
    expect(buffer.search).toBe("")
  })

  it("ignores composing keys and Control/Meta/Alt combinations", () => {
    const buffer = typeaheadBuffer(scheduler)
    buffer.push(k("a", { composing: true }))
    buffer.push(k("a", { ctrl: true }))
    buffer.push(k("a", { meta: true }))
    buffer.push(k("a", { alt: true }))
    expect(buffer.search).toBe("")
  })
})
