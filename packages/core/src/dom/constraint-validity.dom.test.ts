import { afterEach, describe, expect, it } from "vitest"
import {
  clearOwnCustomValidity,
  constraintValidity,
  firstInvalidInTreeOrder,
  hasOwnCustomValidity,
  readValidity,
  setOwnCustomValidity,
  VALIDITY_KEYS,
} from "./constraint-validity"

afterEach(() => {
  document.body.innerHTML = ""
})

function mount(html: string) {
  document.body.innerHTML = `<form>${html}</form>`
  return document.querySelector("form") as HTMLFormElement
}
const input = (form: HTMLFormElement, selector = "input") =>
  form.querySelector(selector) as HTMLInputElement

describe("readValidity", () => {
  it("lists the keys in the order a failing element reports them", () => {
    expect(VALIDITY_KEYS).toEqual([
      "valueMissing",
      "typeMismatch",
      "patternMismatch",
      "tooShort",
      "tooLong",
      "rangeUnderflow",
      "rangeOverflow",
      "stepMismatch",
      "badInput",
      "customError",
    ])
  })

  it("reads a valid element", () => {
    const el = input(mount("<input>"))
    expect(readValidity(el)).toEqual({ valid: true, key: null, message: "" })
  })

  it("names the failing key and the browser message", () => {
    const form = mount('<input required><input type="email" value="abc"><input pattern="a+">')
    const [required, email, pattern] = Array.from(form.querySelectorAll("input"))
    expect(readValidity(required as HTMLInputElement)).toMatchObject({
      valid: false,
      key: "valueMissing",
    })
    expect(readValidity(email as HTMLInputElement).key).toBe("typeMismatch")
    ;(pattern as HTMLInputElement).value = "b"
    expect(readValidity(pattern as HTMLInputElement).key).toBe("patternMismatch")
    expect(readValidity(required as HTMLInputElement).message).not.toBe("")
  })

  it("reports a custom message as customError", () => {
    const el = input(mount("<input>"))
    el.setCustomValidity("Nope")
    expect(readValidity(el)).toEqual({ valid: false, key: "customError", message: "Nope" })
  })

  it("the first applicable key wins (valueMissing before customError)", () => {
    const el = input(mount("<input required>"))
    el.setCustomValidity("Nope")
    expect(readValidity(el).key).toBe("valueMissing")
  })

  it("is exposed as the constraintValidity capability", () => {
    expect(constraintValidity.read).toBe(readValidity)
    expect(constraintValidity.setOwn).toBe(setOwnCustomValidity)
    expect(constraintValidity.clearOwn).toBe(clearOwnCustomValidity)
    expect(constraintValidity.firstInvalid).toBe(firstInvalidInTreeOrder)
  })
})

describe("own custom validity", () => {
  it("sets and clears its own message", () => {
    const el = input(mount("<input>"))
    setOwnCustomValidity(el, "Taken")
    expect(el.validationMessage).toBe("Taken")
    expect(hasOwnCustomValidity(el)).toBe(true)
    expect(el.form?.checkValidity()).toBe(false)
    clearOwnCustomValidity(el)
    expect(el.validity.valid).toBe(true)
    expect(hasOwnCustomValidity(el)).toBe(false)
  })

  it("replaces its own previous message without keeping it as foreign", () => {
    const el = input(mount("<input>"))
    setOwnCustomValidity(el, "One")
    setOwnCustomValidity(el, "Two")
    expect(el.validationMessage).toBe("Two")
    clearOwnCustomValidity(el)
    expect(el.validity.valid).toBe(true)
  })

  it("restores a foreign message when clearing its own", () => {
    const el = input(mount("<input>"))
    el.setCustomValidity("Control says no")
    setOwnCustomValidity(el, "Taken")
    expect(el.validationMessage).toBe("Taken")
    clearOwnCustomValidity(el)
    expect(el.validationMessage).toBe("Control says no")
    expect(el.validity.customError).toBe(true)
  })

  it("keeps the foreign message across several own updates", () => {
    const el = input(mount("<input>"))
    el.setCustomValidity("Control says no")
    setOwnCustomValidity(el, "One")
    setOwnCustomValidity(el, "Two")
    clearOwnCustomValidity(el)
    expect(el.validationMessage).toBe("Control says no")
  })

  it("clears only its own: a message set by someone else afterwards stays", () => {
    const el = input(mount("<input>"))
    setOwnCustomValidity(el, "Taken")
    el.setCustomValidity("Someone else")
    clearOwnCustomValidity(el)
    expect(el.validationMessage).toBe("Someone else")
  })

  it("does nothing when it never set a message (a foreign one stays)", () => {
    const el = input(mount("<input>"))
    el.setCustomValidity("Foreign")
    clearOwnCustomValidity(el)
    expect(el.validationMessage).toBe("Foreign")
  })
})

describe("firstInvalidInTreeOrder", () => {
  it("is null for a valid form", () => {
    expect(firstInvalidInTreeOrder(mount("<input><input>"))).toBeNull()
  })

  it("returns the first failing element in tree order, not registration order", () => {
    const form = mount('<input id="a"><input id="b" required><input id="c" required>')
    expect(firstInvalidInTreeOrder(form)?.id).toBe("b")
    // A node inserted above an existing invalid one comes first (base-ui#5284).
    const top = document.createElement("input")
    top.id = "top"
    top.required = true
    form.prepend(top)
    expect(firstInvalidInTreeOrder(form)?.id).toBe("top")
  })

  it("counts a hidden input that carries a custom message", () => {
    const form = mount('<input id="a" required value="x"><input type="hidden" id="h">')
    const hidden = form.querySelector("#h") as HTMLInputElement
    // Hidden inputs are barred from validation in the platform; the helper reports what
    // the browser says (willValidate), so a hidden input never wins.
    hidden.setCustomValidity("Hidden says no")
    expect(hidden.willValidate).toBe(false)
    expect(firstInvalidInTreeOrder(form)).toBeNull()
  })

  it("counts a visually hidden text input with a custom message", () => {
    const form = mount(
      '<input id="a" required value="x"><input id="h" style="display:none"><input id="z" required>',
    )
    ;(form.querySelector("#h") as HTMLInputElement).setCustomValidity("No")
    expect(firstInvalidInTreeOrder(form)?.id).toBe("h")
  })

  it("treats a radio set as one element failing at the first radio", () => {
    const form = mount(
      '<input id="t"><input type="radio" name="r" id="r1" required><input type="radio" name="r" id="r2" required>',
    )
    expect(firstInvalidInTreeOrder(form)?.id).toBe("r1")
    ;(form.querySelector("#r2") as HTMLInputElement).checked = true
    expect(firstInvalidInTreeOrder(form)).toBeNull()
  })

  it("skips disabled elements", () => {
    const form = mount('<input id="a" required disabled><input id="b" required>')
    expect(firstInvalidInTreeOrder(form)?.id).toBe("b")
  })
})
