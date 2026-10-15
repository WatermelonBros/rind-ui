// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearOwnCustomValidity,
  setControlValidity,
  setOwnCustomValidity,
} from "./constraint-validity"
import {
  type FormInputCapability,
  hiddenFormInput,
  implicitSubmit,
  type TrackOptions,
} from "./hidden-input"

/** A scheduler whose frames run when the test says so. */
function fakeEnv() {
  let frames: (() => void)[] = []
  return {
    env: {
      scheduler: {
        setTimeout: () => 0,
        clearTimeout: () => {},
        requestAnimationFrame: (cb: () => void) => {
          frames.push(cb)
          return frames.length - 1
        },
        cancelAnimationFrame: (h: unknown) => {
          frames[h as number] = () => {}
        },
      },
      modality: {
        modality: () => "keyboard" as const,
        markFocus: () => {},
        unmarkFocus: () => {},
      },
    } as never,
    flush: () => {
      const run = frames
      frames = []
      for (const f of run) f()
    },
  }
}

function mount(html: string) {
  document.body.innerHTML = html
  const q = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
  return q
}

const offs: (() => void)[] = []
afterEach(() => {
  for (const o of offs.splice(0)) o()
  document.body.innerHTML = ""
})

function setup(
  html = '<form><button id="c">c</button><input id="i" type="checkbox"><input id="e" type="text"></form>',
) {
  const q = mount(html)
  const { env, flush } = fakeEnv()
  const cap: FormInputCapability = hiddenFormInput(
    {
      input: () => q<HTMLInputElement>("#i"),
      end: () => q<HTMLInputElement>("#e"),
      control: () => q("#c"),
    },
    env,
  )
  const track = (over: Partial<TrackOptions> = {}) => {
    const o: TrackOptions = {
      onReset: vi.fn(),
      current: () => ({ checked: true }),
      ...over,
    }
    offs.push(cap.track(o))
    return o
  }
  return { q, cap, flush, track }
}

describe("sync", () => {
  it("writes properties, never the checked attribute (radix#2133)", () => {
    const { q, cap } = setup()
    cap.sync({ checked: true }, { dispatch: false })
    expect(q<HTMLInputElement>("#i").checked).toBe(true)
    expect(q("#i").hasAttribute("checked")).toBe(false)
  })

  it("an indeterminate initial value is applied (zag#3402)", () => {
    const { q, cap } = setup()
    cap.sync({ checked: false, indeterminate: true }, { dispatch: false })
    expect(q<HTMLInputElement>("#i").indeterminate).toBe(true)
  })

  it("dispatch fires input then change, bubbling, with checked already updated, no click", () => {
    const { q, cap } = setup()
    const seen: string[] = []
    const click = vi.fn()
    document.addEventListener("click", click)
    for (const type of ["input", "change"]) {
      document.addEventListener(type, (e) => {
        seen.push(`${e.type}:${(e.target as HTMLInputElement).checked}:${e.bubbles}`)
      })
    }
    cap.sync({ checked: true }, { dispatch: true })
    expect(seen).toEqual(["input:true:true", "change:true:true"])
    expect(click).not.toHaveBeenCalled()
    document.removeEventListener("click", click)
    expect(q<HTMLInputElement>("#i").checked).toBe(true)
  })

  it("no dispatch when dispatch is false", () => {
    const { q, cap } = setup()
    const spy = vi.fn()
    q("#i").addEventListener("change", spy)
    cap.sync({ checked: true }, { dispatch: false })
    expect(spy).not.toHaveBeenCalled()
  })

  it("endValue mirrors on a second input and is dispatched too", () => {
    const { q, cap } = setup()
    const ev: string[] = []
    q("#e").addEventListener("input", () => ev.push("end-input"))
    q("#e").addEventListener("change", () => ev.push("end-change"))
    cap.sync({ value: "a", endValue: "b" }, { dispatch: true })
    expect(q<HTMLInputElement>("#i").value).toBe("a")
    expect(q<HTMLInputElement>("#e").value).toBe("b")
    expect(ev).toEqual(["end-input", "end-change"])
  })

  it("a values list: the constraint value is empty when the list is, so required fails", () => {
    const { q, cap } = setup(
      '<form><button id="c">c</button><input id="i" type="text" required><input id="e"></form>',
    )
    cap.sync({ values: [] }, { dispatch: false })
    expect(q<HTMLInputElement>("#i").value).toBe("")
    expect(q<HTMLInputElement>("#i").validity.valueMissing).toBe(true)
    cap.sync({ values: ["a", "b"] }, { dispatch: false })
    expect(q<HTMLInputElement>("#i").value).toBe("a,b")
    expect(q<HTMLInputElement>("#i").validity.valueMissing).toBe(false)
  })
})

describe("validity messages", () => {
  it("a re-sync keeps the message a Field set", () => {
    const { q, cap } = setup()
    const input = q<HTMLInputElement>("#i")
    setOwnCustomValidity(input, "Accept the terms")
    cap.sync({ checked: true }, { dispatch: false })
    expect(input.validationMessage).toBe("Accept the terms")
    expect(input.validity.customError).toBe(true)
  })

  it("the control's message composes with the Field's", () => {
    const { q, cap } = setup()
    const input = q<HTMLInputElement>("#i")
    setControlValidity(input, "Bad input")
    expect(input.validationMessage).toBe("Bad input")
    setOwnCustomValidity(input, "Field says no")
    cap.sync({ checked: true }, { dispatch: false })
    expect(input.validationMessage).toBe("Field says no")
    clearOwnCustomValidity(input)
    cap.sync({ checked: false }, { dispatch: false })
    expect(input.validationMessage).toBe("Bad input")
    setControlValidity(input, "")
    expect(input.validity.customError).toBe(false)
  })

  it("a control message set while the Field's is active takes over when it clears", () => {
    const { q } = setup()
    const input = q<HTMLInputElement>("#i")
    setOwnCustomValidity(input, "Field says no")
    setControlValidity(input, "Bad input")
    expect(input.validationMessage).toBe("Field says no")
    clearOwnCustomValidity(input)
    expect(input.validationMessage).toBe("Bad input")
  })
})

describe("track", () => {
  it("a form reset calls onReset, then re-syncs the input on the next frame", () => {
    const { q, track, flush } = setup()
    const o = track()
    const input = q<HTMLInputElement>("#i")
    q<HTMLFormElement>("form").dispatchEvent(
      new Event("reset", { bubbles: true, cancelable: true }),
    )
    expect(o.onReset).toHaveBeenCalledTimes(1)
    input.checked = false // what the browser's reset leaves behind
    flush()
    expect(input.checked).toBe(true)
  })

  it("a prevented reset is ignored", () => {
    const { q, track, flush } = setup()
    const o = track()
    const form = q<HTMLFormElement>("form")
    form.addEventListener("reset", (e) => e.preventDefault())
    form.dispatchEvent(new Event("reset", { bubbles: true, cancelable: true }))
    flush()
    expect(o.onReset).not.toHaveBeenCalled()
  })

  it("a reset of another form is ignored", () => {
    const { q, track } = setup(
      '<form id="f"><input id="i" type="checkbox"><input id="e"><button id="c"></button></form><form id="g"></form>',
    )
    const o = track()
    q("#g").dispatchEvent(new Event("reset", { bubbles: true, cancelable: true }))
    expect(o.onReset).not.toHaveBeenCalled()
  })

  it("finds the form= form at event time", () => {
    const { q, track } = setup(
      '<form id="f"></form><input id="i" type="checkbox"><input id="e"><button id="c"></button>',
    )
    const o = track()
    q("#i").setAttribute("form", "f")
    q("#f").dispatchEvent(new Event("reset", { bubbles: true, cancelable: true }))
    expect(o.onReset).toHaveBeenCalledTimes(1)
  })

  it("resetsWithForm: false skips onReset but still re-syncs", () => {
    const { q, track, flush } = setup()
    const o = track({ resetsWithForm: false })
    const input = q<HTMLInputElement>("#i")
    q<HTMLFormElement>("form").dispatchEvent(
      new Event("reset", { bubbles: true, cancelable: true }),
    )
    input.checked = false
    flush()
    expect(o.onReset).not.toHaveBeenCalled()
    expect(input.checked).toBe(true)
  })

  it("focus on the hidden input is forwarded to the visible control", () => {
    const { q, track } = setup()
    track()
    q<HTMLInputElement>("#i").dispatchEvent(new FocusEvent("focus"))
    return vi.waitFor(() => expect(document.activeElement).toBe(q("#c")))
  })

  it("onNativeInput accepted: the component follows, no re-sync", () => {
    const { q, track, flush } = setup()
    const onNativeInput = vi.fn(() => true)
    track({ onNativeInput })
    const input = q<HTMLInputElement>("#i")
    input.checked = false
    input.dispatchEvent(new Event("change", { bubbles: true }))
    flush()
    expect(onNativeInput).toHaveBeenCalled()
    expect(input.checked).toBe(false)
  })

  it("onNativeInput rejected: the input is re-synced from the component", () => {
    const { q, track, flush } = setup()
    track({ onNativeInput: () => false })
    const input = q<HTMLInputElement>("#i")
    input.checked = false
    input.dispatchEvent(new Event("change", { bubbles: true }))
    flush()
    expect(input.checked).toBe(true)
  })

  it("its own dispatch is not treated as native input", () => {
    const { cap, track } = setup()
    const onNativeInput = vi.fn(() => true)
    track({ onNativeInput })
    cap.sync({ checked: true }, { dispatch: true })
    expect(onNativeInput).not.toHaveBeenCalled()
  })

  it("the returned function stops listening", () => {
    const { q, cap } = setup()
    const o: TrackOptions = { onReset: vi.fn(), current: () => ({}) }
    cap.track(o)()
    q<HTMLFormElement>("form").dispatchEvent(
      new Event("reset", { bubbles: true, cancelable: true }),
    )
    expect(o.onReset).not.toHaveBeenCalled()
  })
})

describe("implicitSubmit", () => {
  it("clicks the first submit button, including one outside the form via form=", () => {
    mount('<form id="f"><input id="x"></form><button id="out" form="f" type="submit">go</button>')
    const click = vi.fn((e: Event) => e.preventDefault())
    document.querySelector("#out")?.addEventListener("click", click)
    implicitSubmit(document.querySelector("#f"))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("the first in tree order wins", () => {
    mount('<form id="f"><button id="a">a</button><button id="b">b</button></form>')
    const a = vi.fn((e: Event) => e.preventDefault())
    const b = vi.fn((e: Event) => e.preventDefault())
    document.querySelector("#a")?.addEventListener("click", a)
    document.querySelector("#b")?.addEventListener("click", b)
    implicitSubmit(document.querySelector("#f"))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it("does nothing with no submit button, a disabled default button, or no form", () => {
    mount('<form id="f"><input><button type="button" id="n">n</button></form>')
    const submit = vi.fn((e: Event) => e.preventDefault())
    document.querySelector("#f")?.addEventListener("submit", submit)
    implicitSubmit(document.querySelector("#f"))
    mount('<form id="f"><button id="d" disabled>d</button><button id="e">e</button></form>')
    const e2 = vi.fn()
    document.querySelector("#e")?.addEventListener("click", e2)
    document.querySelector("#f")?.addEventListener("submit", submit)
    implicitSubmit(document.querySelector("#f"))
    implicitSubmit(null)
    expect(submit).not.toHaveBeenCalled()
    expect(e2).not.toHaveBeenCalled()
  })
})
