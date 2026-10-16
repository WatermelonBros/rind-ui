// The Pin Input machine in Node (tasks 2.3): completion counts, controlled clear, no holes,
// refusal and re-sync, parent changes and resets never complete.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { planEdit } from "./edit-plan"
import { type PinInputProps, pinInputMachine, renderedValue } from "./pin-input.machine"
import { pinInputMessages } from "./pin-input.messages"

function make(over: Partial<PinInputProps> = {}) {
  const spies = {
    onValueChange: vi.fn(),
    onValueComplete: vi.fn(),
    onValueInvalid: vi.fn(),
    writeCaret: vi.fn(),
    resync: vi.fn(),
    requestSubmit: vi.fn(),
  }
  const props: PinInputProps = { length: 6, messages: pinInputMessages, id: "p", ...spies, ...over }
  const s = createService(pinInputMachine, props as never, {} as never)
  s.start()
  const value = () => s.view().values.value
  const type = (data: string, inputType = "insertText") => {
    const caret = s.getSnapshot().context.caret
    const plan = planEdit(value(), [caret, caret], { inputType, data }, props)
    if (!plan.accept) s.send({ type: "INVALID", text: plan.text })
    else if (plan.edit) s.send({ type: "EDIT", edit: plan.edit })
  }
  return { s, ...spies, props, value, type, caret: () => s.getSnapshot().context.caret }
}

describe("value and caret", () => {
  it("typing fills from the first slot; a press past the value lands at its end", () => {
    const m = make()
    m.s.send({ type: "SLOT.PRESS", index: 4, modality: "pointer" })
    expect(m.caret()).toBe(0)
    m.type("7")
    expect(m.value()).toBe("7")
    expect(m.writeCaret).toHaveBeenLastCalledWith(1)
  })

  it("a press on a filled slot replaces it (input-otp#31)", () => {
    const m = make({ defaultValue: "12345" })
    m.s.send({ type: "SLOT.PRESS", index: 1, modality: "pointer" })
    m.type("9")
    expect(m.value()).toBe("19345")
    expect(m.caret()).toBe(2)
  })

  it("controlled null / undefined render empty (ark#3573)", () => {
    expect(renderedValue({ length: 6 }, undefined)).toBe("")
    expect(renderedValue({ length: 6 }, null)).toBe("")
    expect(renderedValue({ length: 6 }, "1234567")).toBe("123456")
    expect(renderedValue({ length: 6 }, "12a")).toBe("")
  })

  it("a refused character calls onValueInvalid and changes nothing", () => {
    const m = make()
    m.type("&")
    expect(m.onValueInvalid).toHaveBeenCalledWith("&")
    expect(m.value()).toBe("")
  })
})

describe("completion (base-ui#4679)", () => {
  it("once when typing fills the code; autoSubmit requests submission", () => {
    const m = make({ autoSubmit: true })
    for (const d of "123456") m.type(d)
    expect(m.onValueComplete).toHaveBeenCalledTimes(1)
    expect(m.onValueComplete).toHaveBeenCalledWith("123456")
    expect(m.requestSubmit).toHaveBeenCalledTimes(1)
    // Retyping the same full code at the end changes nothing and does not complete again.
    m.type("7")
    expect(m.onValueComplete).toHaveBeenCalledTimes(1)
  })

  it("a paste replacing a complete code completes again", () => {
    const m = make({ defaultValue: "111111" })
    m.type("222222", "insertFromPaste")
    expect(m.value()).toBe("222222")
    expect(m.onValueComplete).toHaveBeenCalledWith("222222")
  })

  it("autofill completes (input-otp#152)", () => {
    const m = make()
    m.s.send({ type: "INPUT", text: "246810", reason: "AUTOFILL" })
    expect(m.value()).toBe("246810")
    expect(m.onValueComplete).toHaveBeenCalledTimes(1)
  })

  it("a fill inserted into a partial code replaces it (WCAG 3.3.8)", () => {
    const m = make({ defaultValue: "12" })
    // The browser inserted the SMS code at the caret: the DOM text mixes both.
    m.s.send({ type: "INPUT", text: "12534418", reason: "AUTOFILL" })
    expect(m.value()).toBe("534418")
    expect(m.onValueComplete).toHaveBeenCalledWith("534418")
    // Inserted in the middle too.
    const n = make({ defaultValue: "12" })
    n.s.send({ type: "INPUT", text: "1534418 2", reason: "AUTOFILL" })
    expect(n.value()).toBe("534418")
  })

  it("a reset and a parent's change never complete", () => {
    const m = make({ defaultValue: "123456" })
    m.s.send({ type: "INPUT", text: "", reason: "INPUT" })
    m.s.send({ type: "RESET" })
    expect(m.value()).toBe("123456")
    const c = make({ value: "" })
    c.s.setProps({ ...c.props, value: "123456" })
    expect(c.onValueComplete).not.toHaveBeenCalled()
    expect(m.onValueComplete).not.toHaveBeenCalled()
  })
})

describe("read-only and composition", () => {
  it("read-only refuses autofill and re-syncs (base-ui#4805)", () => {
    const m = make({ readOnly: true, defaultValue: "12" })
    m.s.send({ type: "INPUT", text: "999999", reason: "AUTOFILL" })
    expect(m.value()).toBe("12")
    expect(m.resync).toHaveBeenCalled()
  })

  it("the committed text is applied once at its end (zag#1507)", () => {
    const m = make()
    m.s.send({ type: "COMPOSITION.START", caret: 0 })
    expect(m.s.getSnapshot().state).toBe("composing")
    m.s.send({ type: "COMPOSITION.END", text: "１２３" })
    expect(m.value()).toBe("123")
    expect(m.s.getSnapshot().state).toBe("idle")
  })
})
