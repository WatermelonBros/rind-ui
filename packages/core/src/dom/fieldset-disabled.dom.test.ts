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

// openspec fieldset "Disabled Propagation": the rule is HTML's own. A native <input> in the
// same markup is the oracle (`:disabled`), so a browser difference shows up here.
describe("isFieldsetDisabled agrees with native :disabled", () => {
  const inputs = (n: number) => Array.from({ length: n }, (_, i) => `<input id="c${i}">`)
  const table: [string, string][] = [
    ["no fieldset", `<input id="c0">`],
    ["enabled", `<fieldset><input id="c0"></fieldset>`],
    ["disabled", `<fieldset disabled><input id="c0"></fieldset>`],
    [
      "outer disabled, inner enabled",
      `<fieldset disabled><fieldset><input id="c0"></fieldset></fieldset>`,
    ],
    [
      "outer enabled, inner disabled",
      `<fieldset><fieldset disabled><input id="c0"></fieldset></fieldset>`,
    ],
    [
      "three deep, middle disabled",
      `<fieldset><fieldset disabled><fieldset><input id="c0"></fieldset></fieldset></fieldset>`,
    ],
    [
      "first and second legend",
      `<fieldset disabled><legend>${inputs(2)[0]}</legend><legend>${inputs(2)[1]}</legend></fieldset>`,
    ],
    [
      "legend after another child is still the first legend",
      `<fieldset disabled><div></div><legend><input id="c0"></legend></fieldset>`,
    ],
    [
      "legend inside a div",
      `<fieldset disabled><div><legend><input id="c0"></legend></div></fieldset>`,
    ],
    ["legend of an enabled fieldset", `<fieldset><legend><input id="c0"></legend></fieldset>`],
    [
      "legend of an enabled inner fieldset in a disabled one",
      `<fieldset disabled><fieldset><legend><input id="c0"></legend></fieldset></fieldset>`,
    ],
    [
      "legend of a disabled inner fieldset in a disabled one",
      `<fieldset disabled><fieldset disabled><legend><input id="c0"></legend></fieldset></fieldset>`,
    ],
    [
      "legend of a disabled inner fieldset in an enabled one",
      `<fieldset><fieldset disabled><legend><input id="c0"></legend></fieldset></fieldset>`,
    ],
    [
      "disabled fieldset inside the legend of a disabled one",
      `<fieldset disabled><legend><fieldset disabled><input id="c0"></fieldset></legend></fieldset>`,
    ],
    [
      "enabled fieldset inside the legend of a disabled one",
      `<fieldset disabled><legend><fieldset><input id="c0"></fieldset></legend></fieldset>`,
    ],
    ["control after the legend", `<fieldset disabled><legend>L</legend><input id="c0"></fieldset>`],
  ]

  // WebKit's :disabled ignores the outer disabled fieldset for the first legend of a nested
  // disabled one; HTML (and Chromium, Firefox) say disabled. That row follows the spec.
  const spec = new Set(["legend of a disabled inner fieldset in a disabled one"])

  it.each(table)("%s", (name, html) => {
    mount(html)
    const all = Array.from(document.querySelectorAll("input"))
    expect(all.length).toBeGreaterThan(0)
    for (const input of all) {
      const expected = spec.has(name) ? true : input.matches(":disabled")
      expect(isFieldsetDisabled(input), input.id).toBe(expected)
    }
  })

  it("follows the same answer after a runtime change of the markup", () => {
    const $ = mount(
      `<fieldset id="f" disabled><legend id="l1">A</legend><input id="c0"><legend><input id="c1"></legend></fieldset>`,
    )
    const check = () => {
      for (const input of document.querySelectorAll("input")) {
        expect(isFieldsetDisabled(input), input.id).toBe(input.matches(":disabled"))
      }
    }
    check()
    // The first legend is removed: the second becomes the first.
    $("l1").remove()
    check()
    $("f").removeAttribute("disabled")
    check()
  })
})

describe("watchFieldsetDisabled and the document tree", () => {
  it("fires when a part is moved into a disabled fieldset, and out again (childList)", async () => {
    const $ = mount(
      `<fieldset id="f" disabled></fieldset><fieldset id="g"><button id="a"></button></fieldset>`,
    )
    const onChange = vi.fn()
    const w = watchFieldsetDisabled($("a"), onChange)
    expect(w.disabled).toBe(false)
    $("f").append($("a"))
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(true)
    $("g").append($("a"))
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(onChange).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it("fires when the first legend is removed or inserted", async () => {
    const $ = mount(
      `<fieldset id="f" disabled><legend id="l1"></legend><legend id="l2"><button id="a"></button></legend></fieldset>`,
    )
    const onChange = vi.fn()
    const w = watchFieldsetDisabled($("a"), onChange)
    expect(w.disabled).toBe(true)
    $("l1").remove()
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(false)
    $("f").prepend(document.createElement("legend"))
    await flush()
    expect(onChange).toHaveBeenLastCalledWith(true)
    w.stop()
  })

  it("a childList change that changes nothing does not fire", async () => {
    const $ = mount(`<fieldset id="f"><button id="a"></button></fieldset>`)
    const onChange = vi.fn()
    const w = watchFieldsetDisabled($("a"), onChange)
    $("f").append(document.createElement("div"))
    await flush()
    expect(onChange).not.toHaveBeenCalled()
    w.stop()
  })
})
