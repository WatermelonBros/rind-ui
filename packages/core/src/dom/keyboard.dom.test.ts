// Composition: replays of a Japanese IME and Safari's event order (WebKit 165004).
import { afterEach, describe, expect, it } from "vitest"
import { describeKey, trackComposition } from "./keyboard"
import { platforms } from "./platform"

afterEach(() => {
  document.body.innerHTML = ""
})

function input() {
  document.body.innerHTML = '<input type="text">'
  const el = document.querySelector("input") as HTMLInputElement
  trackComposition(document)
  return el
}
const keydown = (el: Element, init: KeyboardEventInit & { keyCode?: number }) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, ...init })
  if (init.keyCode !== undefined) Object.defineProperty(e, "keyCode", { value: init.keyCode })
  el.dispatchEvent(e)
  return e
}

describe("composing", () => {
  it("Japanese IME in Chrome: the committing Enter has isComposing (and keyCode 229)", () => {
    const el = input()
    el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    const enter = keydown(el, { key: "Enter", isComposing: true, keyCode: 229 })
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
    expect(describeKey(enter, { platform: platforms.windows }).composing).toBe(true)
  })

  it("keyCode 229 alone marks composing", () => {
    const el = input()
    const e = keydown(el, { key: "Process", keyCode: 229 })
    expect(describeKey(e, { platform: platforms.windows }).composing).toBe(true)
  })

  it("Safari: compositionend, then the committing Enter with isComposing false, is still composing", () => {
    const el = input()
    el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
    const commit = keydown(el, { key: "Enter", isComposing: false, keyCode: 13 })
    expect(describeKey(commit, { platform: platforms.apple }).composing).toBe(true)
    // The next Enter is the user's own: it submits.
    const submit = keydown(el, { key: "Enter", keyCode: 13 })
    expect(describeKey(submit, { platform: platforms.apple }).composing).toBe(false)
  })

  it("outside WebKit the same order is a real Enter", () => {
    const el = input()
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
    const e = keydown(el, { key: "Enter", keyCode: 13 })
    expect(describeKey(e, { platform: platforms.windows }).composing).toBe(false)
  })
})

describe("registerHotkey (review round 1)", () => {
  it("Safari: the Enter committing an IME composition never fires an Enter hotkey", async () => {
    const { registerHotkey } = await import("./keyboard")
    document.body.innerHTML = '<div id="scope"><input type="text"></div>'
    const scope = document.getElementById("scope") as HTMLElement
    const field = scope.querySelector("input") as HTMLInputElement
    const fired: string[] = []
    const off = registerHotkey(scope, "Enter", () => fired.push("enter"), {
      platform: { ...platforms.apple, webkit: true },
    })
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
    keydown(field, { key: "Enter" })
    expect(fired).toEqual([])
    keydown(field, { key: "Enter" })
    expect(fired).toEqual(["enter"])
    off()
  })

  it("scoped to a root: only keys from inside it", async () => {
    const { registerHotkey } = await import("./keyboard")
    document.body.innerHTML =
      '<div id="scope"><button>in</button></div><button id="out">out</button>'
    const scope = document.getElementById("scope") as HTMLElement
    const fired: string[] = []
    const off = registerHotkey(scope, "mod+k", () => fired.push("k"), {
      platform: platforms.windows,
    })
    keydown(document.getElementById("out") as HTMLElement, { key: "k", ctrlKey: true })
    keydown(scope.querySelector("button") as HTMLElement, { key: "k", ctrlKey: true })
    expect(fired).toEqual(["k"])
    off()
  })
})
