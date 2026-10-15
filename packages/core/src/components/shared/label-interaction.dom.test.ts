// The label rules every rind-ui label shares (openspec label-interaction), against real
// events. Regressions: radix#2656, bits-ui#1323, base-ui#586/#587, headlessui#3876.
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ModalityEnv } from "../../env/capabilities"
import { checkLabelTarget, isLabelable, labelInteraction, labelTarget } from "./label-interaction"

const env = {
  modality: {
    modality: () => "pointer",
    markFocus: () => {},
    unmarkFocus: () => {},
  },
} as unknown as ModalityEnv

const make = (html: string) => {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  return host
}
afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

const mousedown = (el: Element, detail: number) => {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, detail })
  el.dispatchEvent(event)
  return event
}

describe("double-click selection guard", () => {
  const guard = labelInteraction(env, { target: () => null, forwardsFocus: () => false })
  const wire = (host: HTMLElement) => {
    const label = host.querySelector("label") as HTMLElement
    label.addEventListener("mousedown", guard.onMouseDown)
    return label
  }

  it("prevents a double click on the text (radix#2656)", () => {
    const label = wire(make("<label>Name</label>"))
    expect(mousedown(label, 2).defaultPrevented).toBe(true)
    expect(mousedown(label, 3).defaultPrevented).toBe(true)
  })

  it("never prevents a single press (base-ui#586)", () => {
    const label = wire(make("<label>Name</label>"))
    expect(mousedown(label, 1).defaultPrevented).toBe(false)
  })

  it("keeps word selection and steppers of an interactive descendant (bits-ui#1323)", () => {
    const host = make(
      "<label>Name <input><input type=number><button>b</button><a href='#x'>t</a><span data-rind-pressable>p</span></label>",
    )
    wire(host)
    for (const el of host.querySelectorAll("input, button, a, [data-rind-pressable]")) {
      expect(mousedown(el, 2).defaultPrevented).toBe(false)
    }
  })

  it("respects an event the consumer already prevented", () => {
    const host = make("<label>Name</label>")
    const label = host.querySelector("label") as HTMLElement
    const seen: boolean[] = []
    label.addEventListener("mousedown", (e) => e.preventDefault())
    label.addEventListener("mousedown", (e) => {
      seen.push(e.defaultPrevented)
      guard.onMouseDown(e)
    })
    expect(mousedown(label, 2).defaultPrevented).toBe(true)
    expect(seen).toEqual([true])
  })

  it("an anchor without href is not interactive", () => {
    const host = make("<label>Name <a>no href</a></label>")
    wire(host)
    expect(mousedown(host.querySelector("a") as Element, 2).defaultPrevented).toBe(true)
  })
})

describe("focus forwarding", () => {
  const click = (label: Element, init: MouseEventInit = {}) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, ...init })
    label.dispatchEvent(event)
    return event
  }
  const wire = (host: HTMLElement, options: Parameters<typeof labelInteraction>[1]) => {
    const label = host.querySelector("span") as HTMLElement
    label.addEventListener("click", labelInteraction(env, options).onClick)
    return label
  }

  it("focuses a div target (base-ui#587)", () => {
    const host = make('<span>Colour</span><div id="c" tabindex="0"></div>')
    const label = wire(host, { target: () => host.querySelector("#c"), forwardsFocus: () => true })
    click(label)
    expect(document.activeElement?.id).toBe("c")
  })

  it("does nothing when the label is native (forwardsFocus false)", () => {
    const host = make('<span>Colour</span><div id="c" tabindex="0"></div>')
    const label = wire(host, { target: () => host.querySelector("#c"), forwardsFocus: () => false })
    click(label)
    expect(document.activeElement).toBe(document.body)
  })

  it("focusTarget overrides the default focus (a group's tab stop)", () => {
    const host = make(
      '<span>Size</span><div id="g" tabindex="0" role="radiogroup"><span id="r" tabindex="-1" role="radio"></span></div>',
    )
    const label = wire(host, {
      target: () => host.querySelector("#g"),
      forwardsFocus: () => true,
      focusTarget: () => (host.querySelector("#r") as HTMLElement).focus(),
    })
    click(label)
    expect(document.activeElement?.id).toBe("r")
  })

  it("never cancels the click and respects a descendant's preventDefault (radix#609)", () => {
    const host = make('<span>L<b id="d">x</b></span><div id="c" tabindex="0"></div>')
    const label = wire(host, { target: () => host.querySelector("#c"), forwardsFocus: () => true })
    expect(click(label).defaultPrevented).toBe(false)
    host.querySelector<HTMLElement>("#c")?.blur()
    const d = host.querySelector("#d") as Element
    d.addEventListener("click", (e) => e.preventDefault())
    click(d)
    expect(document.activeElement?.id).not.toBe("c")
  })

  it("ignores clicks that start on an interactive descendant", () => {
    const host = make('<span>L<button id="b">x</button></span><div id="c" tabindex="0"></div>')
    const label = wire(host, { target: () => host.querySelector("#c"), forwardsFocus: () => true })
    click(host.querySelector("#b") as Element)
    expect(document.activeElement?.id).not.toBe("c")
    click(label)
    expect(document.activeElement?.id).toBe("c")
  })
})

describe("isLabelable", () => {
  const cases: [string, boolean][] = [
    ["<input>", true],
    ["<input type=hidden>", false],
    ["<input type=checkbox>", true],
    ["<select></select>", true],
    ["<textarea></textarea>", true],
    ["<button></button>", true],
    ["<meter></meter>", true],
    ["<progress></progress>", true],
    ["<output></output>", true],
    ["<div></div>", false],
    ["<span tabindex=0></span>", false],
    ["<a href='#'></a>", false],
  ]
  it.each(cases)("%s -> %s", (html, expected) => {
    const host = make(html)
    expect(isLabelable(host.firstElementChild as Element)).toBe(expected)
  })
})

describe("labelTarget", () => {
  it("looks `for` up by id and finds a wrapped control", () => {
    const host = make(
      '<label id="a" for="x">A</label><input id="x"><label id="b">B<input id="y"></label>',
    )
    expect(labelTarget(host.querySelector("#a") as Element, "x")?.id).toBe("x")
    expect(labelTarget(host.querySelector("#b") as Element, undefined)?.id).toBe("y")
    expect(labelTarget(host.querySelector("#a") as Element, "nope")).toBeNull()
  })

  it("resolves through the label's own shadow root", () => {
    const host = make("")
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = '<label id="l" for="x">A</label><input id="x">'
    document.body.insertAdjacentHTML("beforeend", '<input id="x" data-outside>')
    const found = labelTarget(shadow.querySelector("label") as Element, "x")
    expect(found).toBe(shadow.querySelector("input"))
  })
})

describe("checkLabelTarget", () => {
  const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})

  it("is silent for a labelable target and without `for`", () => {
    const w = warn()
    const host = make('<label id="l" for="x">A</label><input id="x"><label id="n">N</label>')
    expect(checkLabelTarget(host.querySelector("#l") as Element, "x")).toBe(false)
    expect(checkLabelTarget(host.querySelector("#n") as Element, undefined)).toBe(false)
    expect(w).not.toHaveBeenCalled()
  })

  it("warns once per label for a missing id, naming the label", () => {
    const w = warn()
    const host = make('<label for="ghost"> Email </label>')
    const label = host.firstElementChild as Element
    expect(checkLabelTarget(label, "ghost")).toBe(false)
    expect(checkLabelTarget(label, "ghost")).toBe(false)
    expect(w).toHaveBeenCalledOnce()
    expect(w.mock.calls[0]?.[0]).toContain('label "Email"')
    expect(w.mock.calls[0]?.[0]).toContain("no element")
  })

  it("warns for a div target, says how to fix it, and asks to forward focus (headlessui#3876)", () => {
    const w = warn()
    const host = make('<label for="color">Colour</label><div id="color"></div>')
    expect(checkLabelTarget(host.querySelector("label") as Element, "color")).toBe(true)
    expect(w).toHaveBeenCalledOnce()
    const message = String(w.mock.calls[0]?.[0])
    expect(message).toContain("Colour")
    expect(message).toContain("<div>")
    expect(message).toContain("aria-labelledby")
  })

  it("warns for an input type=hidden", () => {
    const w = warn()
    const host = make('<label for="h">H</label><input id="h" type="hidden">')
    expect(checkLabelTarget(host.querySelector("label") as Element, "h")).toBe(true)
    expect(w).toHaveBeenCalledOnce()
  })
})
