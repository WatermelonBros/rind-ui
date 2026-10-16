// The Search Field preset in Node: Escape clears only when there is something to clear (and
// only then consumes the key), never while composing; Enter searches once, never prevented.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { searchFieldMachine } from "./search-field.machine"
import { searchFieldMessages } from "./search-field.messages"

function make(over: Record<string, unknown> = {}) {
  const clearInput = vi.fn()
  const onSubmit = vi.fn()
  const env = { announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} } }
  const props = { messages: searchFieldMessages, id: "s1", clearInput, onSubmit, ...over }
  const s = createService(searchFieldMachine, props as never, env as never)
  s.start()
  const key = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
  return {
    s,
    clearInput,
    onSubmit,
    escape: (composing = false) => {
      const k = key()
      s.send({ type: "ESCAPE", event: k, composing })
      return k
    },
    enter: (composing = false) => {
      const k = key()
      s.send({ type: "SUBMIT", event: k, composing })
      return k
    },
  }
}

describe("Escape", () => {
  it("clears a non-empty field with reason ESCAPE, keeps focus, consumes the key", () => {
    const m = make({ defaultValue: "tolkien" })
    const k = m.escape()
    expect(m.clearInput).toHaveBeenCalledWith("ESCAPE", true)
    expect(k.preventDefault).toHaveBeenCalled()
    expect(k.stopPropagation).toHaveBeenCalled()
  })

  it("leaves the key alone on an empty field (react-spectrum#5480)", () => {
    const k = make().escape()
    expect(k.preventDefault).not.toHaveBeenCalled()
    expect(k.stopPropagation).not.toHaveBeenCalled()
  })

  it.each([
    ["read-only", { readOnly: true }],
    ["disabled", { disabled: true }],
  ])("is not handled when %s", (_, over) => {
    const m = make({ defaultValue: "a", ...over })
    const k = m.escape()
    expect(m.clearInput).not.toHaveBeenCalled()
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("never clears while composing (react-spectrum#10249)", () => {
    const m = make({ defaultValue: "한" })
    m.s.send({ type: "COMPOSITION.START" })
    expect(m.escape(true).preventDefault).not.toHaveBeenCalled()
    // Safari: the key arrives after compositionend still marked composing.
    m.s.send({ type: "COMPOSITION.END", value: "한", event: null })
    m.escape(true)
    expect(m.clearInput).not.toHaveBeenCalled()
  })
})

describe("Enter", () => {
  it("calls onSubmit once with the value and the key, never prevents it", () => {
    const m = make({ defaultValue: "dune" })
    const k = m.enter()
    expect(m.onSubmit).toHaveBeenCalledTimes(1)
    expect(m.onSubmit).toHaveBeenCalledWith("dune", { event: k })
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("an IME commit Enter is not a search (react-spectrum#6421)", () => {
    const m = make()
    m.enter(true)
    expect(m.onSubmit).not.toHaveBeenCalled()
    m.s.send({ type: "INPUT", value: "被送出", composing: false, reason: "INPUT", event: null })
    m.enter()
    expect(m.onSubmit).toHaveBeenCalledWith("被送出", expect.anything())
  })
})
