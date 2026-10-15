// Toggle's parts in Node (openspec toggle "ARIA Semantics", "Data Attributes", "Stable Accessible Name").
import { afterEach, describe, expect, it, vi } from "vitest"
import { CRITICAL } from "../../connect/props"
import type { LinkEnv } from "../../dom/link"
import { platforms } from "../../dom/platform"
import { checkStableName, type ToggleConnectState, toggleConnect } from "./toggle.connect"

const env: LinkEnv = {
  platform: platforms.linux,
  modality: {
    modality: () => "pointer",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}
const base: ToggleConnectState = {
  instance: "i1",
  tag: "button",
  on: false,
  disabled: false,
  focusableWhenDisabled: false,
  focused: false,
  modality: "pointer",
  pressed: false,
  hovered: false,
}
const connect = (over: Partial<ToggleConnectState> = {}) => toggleConnect({ ...base, ...over }, env)

describe("root", () => {
  it("aria-pressed is explicit, data-state follows", () => {
    const off = connect().root()
    expect(off).toMatchObject({
      "data-scope": "toggle",
      "data-part": "root",
      "aria-pressed": "false",
      "data-state": "off",
      type: "button",
    })
    expect(connect({ on: true }).root()).toMatchObject({
      "aria-pressed": "true",
      "data-state": "on",
    })
  })

  it("data-pressed is only a press in progress, never on", () => {
    expect(connect({ on: true }).root()["data-pressed"]).toBeUndefined()
    expect(connect({ pressed: true }).root()["data-pressed"]).toBe("")
  })

  it("a span gets role button and tabIndex 0", () => {
    const p = connect({ tag: "span" }).root()
    expect(p["role"]).toBe("button")
    expect(p["tabindex"]).toBe(0)
  })

  it("disabled: native disabled on a button, with data-disabled", () => {
    const p = connect({ disabled: true }).root()
    expect(p["disabled"]).toBe(true)
    expect(p["aria-disabled"]).toBeUndefined()
    expect(p["data-disabled"]).toBe("")
  })

  it("focusableWhenDisabled: aria-disabled, no native disabled", () => {
    const p = connect({ disabled: true, focusableWhenDisabled: true }).root()
    expect(p["aria-disabled"]).toBe("true")
    expect(p["disabled"]).toBeUndefined()
    expect(p["data-disabled"]).toBe("")
  })

  it("aria-pressed is accessibility-critical", () => {
    expect(connect().root()[CRITICAL]).toContain("aria-pressed")
  })
})

describe("indicator", () => {
  it("decorative, with state and disabled", () => {
    expect(connect({ on: true, disabled: true }).indicator()).toMatchObject({
      "data-scope": "toggle",
      "data-part": "indicator",
      "aria-hidden": "true",
      "data-state": "on",
      "data-disabled": "",
    })
    expect(connect().indicator()["data-state"]).toBe("off")
  })
})

describe("checkStableName", () => {
  afterEach(() => vi.restoreAllMocks())
  const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})

  it("warns naming both when name and state changed", () => {
    const w = warn()
    checkStableName({ name: "Mute", on: false }, { name: "Unmute", on: true })
    expect(w).toHaveBeenCalledTimes(1)
    expect(String(w.mock.calls[0]?.[0])).toContain('"Mute" → "Unmute"')
  })
  it("silent when only the name changed, only the state changed, or first call", () => {
    const w = warn()
    checkStableName({ name: "Mute", on: false }, { name: "Other", on: false })
    checkStableName({ name: "Mute", on: false }, { name: "Mute", on: true })
    checkStableName(undefined, { name: "Mute", on: true })
    expect(w).not.toHaveBeenCalled()
  })
})
