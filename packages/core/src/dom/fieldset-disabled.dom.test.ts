// "Inside a disabled fieldset" (button-like-element "Disabled Fieldset"): every ancestor
// fieldset, with HTML's first-legend exception applied per fieldset.
import { afterEach, describe, expect, it, vi } from "vitest"
import { isFieldsetDisabled, watchFieldsetDisabled } from "./fieldset-disabled"

afterEach(() => {
  document.body.innerHTML = ""
})

function mount(html: string) {
  document.body.innerHTML = html
  return (id: string) => document.getElementById(id) as HTMLElement
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe("isFieldsetDisabled", () => {
  it("is false with no fieldset or an enabled one", () => {
    const $ = mount(`<button id="a"></button><fieldset><button id="b"></button></fieldset>`)
    expect(isFieldsetDisabled($("a"))).toBe(false)
    expect(isFieldsetDisabled($("b"))).toBe(false)
  })

  it("nearest disabled fieldset", () => {
    const $ = mount(`<fieldset disabled><button id="a"></button></fieldset>`)
    expect(isFieldsetDisabled($("a"))).toBe(true)
  })

  it("outer disabled fieldset around an enabled one", () => {
    const $ = mount(`<fieldset disabled><fieldset><button id="a"></button></fieldset></fieldset>`)
    expect(isFieldsetDisabled($("a"))).toBe(true)
  })

  it("first legend is exempt, a second legend is not", () => {
    const $ = mount(
      `<fieldset disabled><legend><button id="a"></button></legend>` +
        `<legend><button id="b"></button></legend></fieldset>`,
    )
    expect(isFieldsetDisabled($("a"))).toBe(false)
    expect(isFieldsetDisabled($("b"))).toBe(true)
  })

  it("a legend that is not a direct child is not the exemption", () => {
    const $ = mount(
      `<fieldset disabled><div><legend><button id="a"></button></legend></div></fieldset>`,
    )
    expect(isFieldsetDisabled($("a"))).toBe(true)
  })

  it("first legend of an enabled fieldset nested in a disabled one is disabled", () => {
    const $ = mount(
      `<fieldset disabled><fieldset><legend><button id="a"></button></legend></fieldset></fieldset>`,
    )
    expect(isFieldsetDisabled($("a"))).toBe(true)
  })

  it("exempt from the inner disabled fieldset but not from a disabled outer one", () => {
    const $ = mount(
      `<fieldset disabled><fieldset disabled><legend><button id="a"></button></legend>` +
        `</fieldset></fieldset>`,
    )
    expect(isFieldsetDisabled($("a"))).toBe(true)
  })
})

describe("watchFieldsetDisabled", () => {
  it("reports the current state and ignores elements with no fieldset", () => {
    const $ = mount(
      `<button id="a"></button><fieldset disabled><button id="b"></button></fieldset>`,
    )
    const onChange = vi.fn()
    const a = watchFieldsetDisabled($("a"), onChange)
    const b = watchFieldsetDisabled($("b"), onChange)
    expect(a.disabled).toBe(false)
    expect(b.disabled).toBe(true)
    a.stop()
    b.stop()
  })

  it("follows the nearest fieldset toggled at runtime", async () => {
    const $ = mount(`<fieldset id="f"><button id="a"></button></fieldset>`)
    const onChange = vi.fn()
    const w = watchFieldsetDisabled($("a"), onChange)
    $("f").toggleAttribute("disabled", true)
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(true)
    $("f").toggleAttribute("disabled", false)
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(onChange).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it("follows an outer fieldset, and fires only on a real change", async () => {
    const $ = mount(
      `<fieldset id="o"><fieldset id="i"><button id="a"></button></fieldset></fieldset>`,
    )
    const onChange = vi.fn()
    const w = watchFieldsetDisabled($("a"), onChange)
    $("o").toggleAttribute("disabled", true)
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(true)
    // Already disabled by the outer one: the inner toggle changes nothing.
    $("i").toggleAttribute("disabled", true)
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    $("o").toggleAttribute("disabled", false)
    $("i").toggleAttribute("disabled", false)
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(false)
    w.stop()
  })

  it("first legend stays enabled and the second follows the fieldset", async () => {
    const $ = mount(
      `<fieldset id="f"><legend><button id="a"></button></legend>` +
        `<legend><button id="b"></button></legend></fieldset>`,
    )
    const first = vi.fn()
    const second = vi.fn()
    const w1 = watchFieldsetDisabled($("a"), first)
    const w2 = watchFieldsetDisabled($("b"), second)
    $("f").toggleAttribute("disabled", true)
    await flush()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)
    w1.stop()
    w2.stop()
  })

  it("stop() disconnects: no more callbacks, other watchers keep working", async () => {
    const $ = mount(`<fieldset id="f"><button id="a"></button><button id="b"></button></fieldset>`)
    const stopped = vi.fn()
    const kept = vi.fn()
    const w1 = watchFieldsetDisabled($("a"), stopped)
    const w2 = watchFieldsetDisabled($("b"), kept)
    w1.stop()
    $("f").toggleAttribute("disabled", true)
    await flush()
    expect(stopped).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledWith(true)
    w2.stop()
    $("f").toggleAttribute("disabled", false)
    await flush()
    expect(kept).toHaveBeenCalledTimes(1)
  })

  it("stop() of the last watcher disconnects the document observer", () => {
    const $ = mount(`<fieldset><button id="a"></button></fieldset>`)
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect")
    const w = watchFieldsetDisabled($("a"), () => {})
    expect(disconnect).not.toHaveBeenCalled()
    w.stop()
    expect(disconnect).toHaveBeenCalledOnce()
    disconnect.mockRestore()
  })
})
