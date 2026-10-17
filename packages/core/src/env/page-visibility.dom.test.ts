// page-visibility: the document's visibilityState, never window focus or blur.
import { afterEach, describe, expect, it } from "vitest"
import { domEnvironment } from "./dom-environment"

let state: DocumentVisibilityState = "visible"
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })

afterEach(() => {
  state = "visible"
})

const setState = (next: DocumentVisibilityState) => {
  state = next
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("page visibility", () => {
  it("a background tab: hidden() is true and subscribers hear it once", () => {
    const v = domEnvironment().visibility
    const heard: boolean[] = []
    const off = v.subscribe((h) => heard.push(h))
    setState("hidden")
    expect(v.hidden()).toBe(true)
    expect(heard).toEqual([true])
    setState("visible")
    expect(heard).toEqual([true, false])
    off()
  })

  it("an iframe taking focus (window blur) changes nothing (radix#1362)", () => {
    const v = domEnvironment().visibility
    const heard: boolean[] = []
    const off = v.subscribe((h) => heard.push(h))
    window.dispatchEvent(new FocusEvent("blur"))
    expect(v.hidden()).toBe(false)
    expect(heard).toEqual([])
    off()
  })

  it("correct from the start: created while hidden reads hidden (mui/base-ui#5955)", () => {
    setState("hidden")
    expect(domEnvironment().visibility.hidden()).toBe(true)
  })

  it("an injected visibility replaces the document's", () => {
    const fake = { hidden: () => true, subscribe: () => () => {} }
    expect(domEnvironment({ visibility: fake }).visibility).toBe(fake)
  })
})
