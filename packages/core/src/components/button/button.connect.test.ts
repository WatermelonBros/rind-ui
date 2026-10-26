// Button's root attributes, in Node (openspec button "Button Data Attributes", "Pending State").
import { describe, expect, it } from "vitest"
import type { LinkEnv } from "../../dom/link"
import { platforms } from "../../dom/platform"
import { type ButtonConnectState, buttonConnect } from "./button.connect"

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
const base: ButtonConnectState = {
  instance: "i1",
  tag: "button",
  disabled: false,
  focusableWhenDisabled: false,
  pending: false,
  focused: false,
  modality: "pointer",
  pressed: false,
  hovered: false,
}
const connect = (over: Partial<ButtonConnectState> = {}) => buttonConnect({ ...base, ...over }, env)

describe("buttonConnect", () => {
  it("idle: scope, part, instance, state; nothing else", () => {
    const p = connect()
    expect(p).toMatchObject({
      "data-scope": "button",
      "data-part": "root",
      "data-instance": "i1",
      "data-state": "idle",
      type: "button",
    })
    for (const k of ["disabled", "aria-disabled", "role", "data-disabled", "data-pending"]) {
      expect(p[k]).toBeUndefined()
    }
  })

  it("pending: aria-disabled, no native disabled, data-state and data-pending", () => {
    const p = connect({ pending: true })
    expect(p["aria-disabled"]).toBe("true")
    expect(p["disabled"]).toBeUndefined()
    expect(p["data-state"]).toBe("pending")
    expect(p["data-pending"]).toBe("")
    // aria-disabled, so data-disabled too (button-like-element "Shared Data Attributes").
    expect(p["data-disabled"]).toBe("")
  })

  it("a pending submit stays a submit (the default button) and cancels its click", () => {
    const pending = connect({ type: "submit", pending: true })
    expect(pending["type"]).toBe("submit")
    let prevented = false
    ;(pending["onClick"] as (e: unknown) => void)({
      preventDefault: () => {
        prevented = true
      },
    })
    expect(prevented).toBe(true)
    expect(connect({ type: "submit" })["type"]).toBe("submit")
    expect(connect({ type: "reset" })["type"]).toBe("reset")
  })

  it("disabled and pending: native disabled", () => {
    const p = connect({ disabled: true, pending: true })
    expect(p["disabled"]).toBe(true)
    expect(p["aria-disabled"]).toBeUndefined()
    expect(p["data-disabled"]).toBe("")
    expect(p["data-pending"]).toBe("")
  })

  it("disabled and focusableWhenDisabled: aria-disabled, no disabled attribute", () => {
    const p = connect({ disabled: true, focusableWhenDisabled: true })
    expect(p["aria-disabled"]).toBe("true")
    expect(p["disabled"]).toBeUndefined()
    expect(p["data-disabled"]).toBe("")
  })

  it("data-disabled follows disabled or pending (both are aria-disabled or disabled)", () => {
    expect(connect()["data-disabled"]).toBeUndefined()
    expect(connect({ pending: true })["data-disabled"]).toBe("")
    expect(connect({ disabled: true })["data-disabled"]).toBe("")
  })

  it("emits no attribute that only mirrors focusableWhenDisabled", () => {
    expect(Object.keys(connect({ focusableWhenDisabled: true })).join()).not.toMatch(/focusable/)
  })

  it("pressed, hover, focus and focus-visible reflect their inputs", () => {
    const p = connect({ pressed: true, hovered: true, focused: true, modality: "keyboard" })
    expect(p["data-pressed"]).toBe("")
    expect(p["data-hover"]).toBe("")
    expect(p["data-focus"]).toBe("")
    expect(p["data-focus-visible"]).toBe("")
    const q = connect({ focused: true, modality: "pointer" })
    expect(q["data-focus"]).toBe("")
    expect(q["data-focus-visible"]).toBeUndefined()
    expect(connect()["data-pressed"]).toBeUndefined()
  })

  it("div: role button and tabindex 0; no type", () => {
    const p = connect({ tag: "div", type: "submit" })
    expect(p["role"]).toBe("button")
    expect(p["tabindex"]).toBe(0)
    expect(p["type"]).toBeUndefined()
  })

  it("pending div stays focusable with aria-disabled", () => {
    const p = connect({ tag: "div", pending: true })
    expect(p["tabindex"]).toBe(0)
    expect(p["aria-disabled"]).toBe("true")
  })

  it("anchor with href: link, no role, no type; disabled drops href", () => {
    const a = connect({ tag: "a", href: "/docs" })
    expect(a["role"]).toBeUndefined()
    expect(a["type"]).toBeUndefined()
    expect(a["href"]).toBe("/docs")
    const d = connect({ tag: "a", href: "/docs", disabled: true })
    expect(d["href"]).toBeUndefined()
    expect(d["role"]).toBe("link")
    expect(d["aria-disabled"]).toBe("true")
    expect(d["tabindex"]).toBe(-1)
  })
})
