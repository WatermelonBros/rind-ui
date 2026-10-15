// Every transition of the Form machine in Node (openspec form, design §2). Fields are fakes
// with an order number (tree order) and a mutable status; the announcer only records.
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type FormField, type FormProps, formMachine } from "./form.machine"
import { formMessages } from "./form.messages"

// inTreeOrder reads the `Node` global, which Node does not have.
beforeAll(() => {
  Reflect.set(globalThis, "Node", { DOCUMENT_POSITION_FOLLOWING: 4 })
})

type Status = ReturnType<FormField["status"]>

/** A Field whose element is a stand-in with a document position (`order`). */
function fake(id: string, order: number, status: Status = "valid", value: unknown = id) {
  const state = { status, order, mounted: true }
  const el = {
    compareDocumentPosition: (other: { order: number }) => (other.order > el.order ? 4 : 2),
    get order() {
      return state.order
    },
  }
  const field = {
    id,
    name: id,
    element: () => el as unknown as Element,
    attempt: vi.fn(),
    status: () => state.status,
    focus: vi.fn(),
    value: () => value,
  } satisfies FormField
  return { field, state }
}

function make(opts: { fields?: ReturnType<typeof fake>[]; props?: Partial<FormProps> } = {}) {
  const registry = [...(opts.fields ?? [])]
  const log: Announcement[] = []
  const requestSubmit = vi.fn()
  let props: FormProps = {
    messages: formMessages,
    fields: () => registry.map((f) => f.field),
    requestSubmit,
    ...opts.props,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const s = createService(formMachine, props, env as never)
  s.start()
  const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as SubmitEvent
  return {
    s,
    log,
    registry,
    requestSubmit,
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context,
    submitEvent,
    attempt: (ev: SubmitEvent | null = submitEvent(), submitter: HTMLElement | null = null) =>
      s.send({ type: "SUBMIT.ATTEMPT", submitEvent: ev, submitter }),
    setProps: (over: Partial<FormProps>) => {
      props = { ...props, ...over }
      s.setProps(props)
    },
  }
}

describe("failed attempt", () => {
  it("cancels the submission, marks failed, focuses the first invalid field", () => {
    const a = fake("a", 1, "valid")
    const b = fake("b", 2, "invalid")
    const f = make({ fields: [a, b] })
    const ev = f.submitEvent()
    f.attempt(ev)
    expect(ev.preventDefault).toHaveBeenCalledTimes(1)
    expect(f.ctx().failed).toBe(true)
    expect(f.state()).toBe("idle")
    expect(b.field.focus).toHaveBeenCalledTimes(1)
    expect(a.field.focus).not.toHaveBeenCalled()
    expect(a.field.attempt).toHaveBeenCalled()
    expect(b.field.attempt).toHaveBeenCalled()
  })

  it("focuses the first in TREE order, not registration order (base-ui#5284)", () => {
    // Registered first, but later in the document.
    const late = fake("late", 2, "invalid")
    const early = fake("early", 1, "invalid")
    const f = make({ fields: [late, early] })
    f.attempt()
    expect(early.field.focus).toHaveBeenCalledTimes(1)
    expect(late.field.focus).not.toHaveBeenCalled()
  })

  it("an attempt from `invalid` events has no submit event to cancel", () => {
    const a = fake("a", 1, "invalid")
    const f = make({ fields: [a] })
    expect(() => f.attempt(null)).not.toThrow()
    expect(a.field.focus).toHaveBeenCalledTimes(1)
  })

  it("announces a summary only for two or more invalid fields, once", () => {
    const one = make({ fields: [fake("a", 1, "invalid"), fake("b", 2)] })
    one.attempt()
    expect(one.log).toEqual([])
    const three = make({
      fields: [fake("a", 1, "invalid"), fake("b", 2, "invalid"), fake("c", 3, "invalid")],
    })
    three.attempt()
    expect(three.log).toEqual([
      { message: "3 fields have errors", priority: "polite", key: "form-summary" },
    ])
  })

  it("uses the messages prop for the summary", () => {
    const f = make({
      fields: [fake("a", 1, "invalid"), fake("b", 2, "invalid")],
      props: { messages: { invalidSummary: (n) => `${n} Fehler` } },
    })
    f.attempt()
    expect(f.log.map((a) => a.message)).toEqual(["2 Fehler"])
  })
})

describe("one-shot focus (ariakit#6307)", () => {
  it("a later registration or status change does not focus", () => {
    const a = fake("a", 1, "invalid")
    const f = make({ fields: [a] })
    f.attempt()
    expect(a.field.focus).toHaveBeenCalledTimes(1)
    const added = fake("z", 0, "invalid")
    f.registry.push(added)
    f.s.send({ type: "FIELD.SETTLED" })
    a.state.status = "valid"
    a.state.status = "invalid"
    f.s.send({ type: "FIELD.SETTLED" })
    f.setProps({ errors: { a: "x" } })
    expect(a.field.focus).toHaveBeenCalledTimes(1)
    expect(added.field.focus).not.toHaveBeenCalled()
  })

  it("a successful attempt after a failed one clears failed; a later field does not focus", () => {
    const a = fake("a", 1, "invalid")
    const f = make({ fields: [a] })
    f.attempt()
    a.state.status = "valid"
    f.attempt()
    expect(f.ctx().failed).toBe(false)
    expect(f.state()).toBe("awaiting-server")
    const added = fake("z", 0, "invalid")
    f.registry.push(added)
    expect(added.field.focus).not.toHaveBeenCalled()
  })
})

describe("removed fields (base-ui#2228)", () => {
  it("an unregistered invalid field is ignored: no throw, no focus, submission proceeds", () => {
    const gone = fake("gone", 1, "invalid")
    const kept = fake("kept", 2, "valid")
    const f = make({ fields: [gone, kept] })
    f.registry.splice(0, 1)
    const ev = f.submitEvent()
    expect(() => f.attempt(ev)).not.toThrow()
    expect(gone.field.attempt).not.toHaveBeenCalled()
    expect(gone.field.focus).not.toHaveBeenCalled()
    expect(f.state()).toBe("awaiting-server")
  })
})

describe("validating hold", () => {
  const held = () => {
    const slow = fake("user", 1, "validating")
    const other = fake("other", 2, "valid")
    const f = make({ fields: [slow, other] })
    const submitter = { isConnected: true, disabled: false } as unknown as HTMLElement
    const ev = f.submitEvent()
    f.attempt(ev, submitter)
    return { slow, other, f, submitter, ev }
  }

  it("cancels the submission and enters validating", () => {
    const { f, ev } = held()
    expect(ev.preventDefault).toHaveBeenCalledTimes(1)
    expect(f.state()).toBe("validating")
    expect(f.requestSubmit).not.toHaveBeenCalled()
    expect(f.ctx().submissions).toBe(0)
  })

  it("FIELD.SETTLED while another is still validating stays held", () => {
    const { f, slow } = held()
    f.s.send({ type: "FIELD.SETTLED" })
    expect(f.state()).toBe("validating")
    slow.state.status = "validating"
    expect(f.requestSubmit).not.toHaveBeenCalled()
  })

  it("settled valid: one resubmit with the same submitter", () => {
    const { f, slow, submitter } = held()
    slow.state.status = "valid"
    f.s.send({ type: "FIELD.SETTLED" })
    expect(f.requestSubmit).toHaveBeenCalledTimes(1)
    expect(f.requestSubmit).toHaveBeenCalledWith(submitter)
    expect(f.state()).toBe("idle")
  })

  it("resubmits with null when the submitter is disconnected or disabled", () => {
    for (const patch of [{ isConnected: false }, { disabled: true }]) {
      const { f, slow, submitter } = held()
      Object.assign(submitter, patch)
      slow.state.status = "valid"
      f.s.send({ type: "FIELD.SETTLED" })
      expect(f.requestSubmit).toHaveBeenCalledWith(null)
    }
  })

  it("settled invalid: focus the first invalid, summary, no resubmit", () => {
    const { f, slow, other } = held()
    slow.state.status = "invalid"
    other.state.status = "invalid"
    f.s.send({ type: "FIELD.SETTLED" })
    expect(f.requestSubmit).not.toHaveBeenCalled()
    expect(slow.field.focus).toHaveBeenCalledTimes(1)
    expect(f.ctx().failed).toBe(true)
    expect(f.log.map((a) => a.message)).toEqual(["2 fields have errors"])
    expect(f.state()).toBe("idle")
  })

  it("a new attempt during the wait replaces the pending one (latest submitter wins)", () => {
    const { f, slow } = held()
    const second = { isConnected: true, disabled: false } as unknown as HTMLElement
    const ev2 = f.submitEvent()
    f.attempt(ev2, second)
    expect(ev2.preventDefault).toHaveBeenCalled()
    expect(f.state()).toBe("validating")
    slow.state.status = "valid"
    f.s.send({ type: "FIELD.SETTLED" })
    expect(f.requestSubmit).toHaveBeenCalledTimes(1)
    expect(f.requestSubmit).toHaveBeenCalledWith(second)
  })
})

describe("VALIDATE (programmatic, ariakit#2397)", () => {
  it("shows errors: attempts every field, marks failed, no focus, no announcement", () => {
    const a = fake("a", 1, "invalid")
    const b = fake("b", 2, "invalid")
    const f = make({ fields: [a, b] })
    f.s.send({ type: "VALIDATE" })
    expect(a.field.attempt).toHaveBeenCalled()
    expect(b.field.attempt).toHaveBeenCalled()
    expect(f.ctx().failed).toBe(true)
    expect(a.field.focus).not.toHaveBeenCalled()
    expect(f.log).toEqual([])
    expect(f.state()).toBe("idle")
  })

  it("all valid: no submission, failed cleared", () => {
    const f = make({ fields: [fake("a", 1, "valid")] })
    f.s.send({ type: "VALIDATE" })
    expect(f.ctx().failed).toBe(false)
    expect(f.ctx().submissions).toBe(0)
    expect(f.state()).toBe("idle")
  })
})

describe("onFormSubmit", () => {
  it("proceeds: values in tree order by name, native submission cancelled", () => {
    const onFormSubmit = vi.fn()
    // Registration order b, a; document order a, b.
    const b = fake("b", 2, "valid", "B")
    const a = fake("a", 1, "valid", "A")
    const f = make({ fields: [b, a], props: { onFormSubmit } })
    const ev = f.submitEvent()
    const submitter = {} as HTMLElement
    f.attempt(ev, submitter)
    expect(ev.preventDefault).toHaveBeenCalledTimes(1)
    expect(onFormSubmit).toHaveBeenCalledTimes(1)
    const [values, details] = onFormSubmit.mock.calls[0] ?? []
    expect(Object.keys(values)).toEqual(["a", "b"])
    expect(values).toEqual({ a: "A", b: "B" })
    expect(details).toEqual({ event: ev, submitter })
    expect(f.ctx().submissions).toBe(1)
    expect(f.state()).toBe("awaiting-server")
  })

  it("without onFormSubmit the native submission is not cancelled", () => {
    const f = make({ fields: [fake("a", 1)] })
    const ev = f.submitEvent()
    f.attempt(ev)
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(f.ctx().submissions).toBe(1)
  })
})

describe("server errors", () => {
  const proceeded = (n: number) => {
    const fields = Array.from({ length: n }, (_, i) => fake(`f${i}`, i + 1))
    const f = make({ fields })
    f.attempt()
    return { f, fields }
  }

  it("errors in awaiting-server: focus the first server-error field in tree order", () => {
    const { f, fields } = proceeded(3)
    f.setProps({ errors: { f2: "x", f1: "y" } })
    expect(f.state()).toBe("idle")
    expect(fields[1]?.field.focus).toHaveBeenCalledTimes(1)
    expect(fields[2]?.field.focus).not.toHaveBeenCalled()
    expect(f.ctx().failed).toBe(true)
    expect(f.log.map((a) => a.message)).toEqual(["2 fields have errors"])
  })

  it("one server error: focus, no summary", () => {
    const { f, fields } = proceeded(2)
    f.setProps({ errors: { f1: "x" } })
    expect(fields[1]?.field.focus).toHaveBeenCalledTimes(1)
    expect(f.log).toEqual([])
  })

  it("errors outside awaiting-server (never submitted) focus nothing", () => {
    const a = fake("a", 1)
    const f = make({ fields: [a] })
    f.setProps({ errors: { a: "x" } })
    expect(a.field.focus).not.toHaveBeenCalled()
    expect(f.state()).toBe("idle")
  })

  it("an empty errors object does not leave awaiting-server", () => {
    const { f } = proceeded(1)
    f.setProps({ errors: {} })
    expect(f.state()).toBe("awaiting-server")
  })

  it("a second errors object after idle does not focus again", () => {
    const { f, fields } = proceeded(1)
    f.setProps({ errors: { f0: "x" } })
    f.setProps({ errors: { f0: "z" } })
    expect(fields[0]?.field.focus).toHaveBeenCalledTimes(1)
  })
})

describe("RESET", () => {
  it("clears failed and returns to idle", () => {
    const a = fake("a", 1, "invalid")
    const f = make({ fields: [a] })
    f.attempt()
    expect(f.ctx().failed).toBe(true)
    f.s.send({ type: "RESET" })
    expect(f.ctx().failed).toBe(false)
    a.state.status = "valid"
    f.attempt()
    f.s.send({ type: "RESET" })
    expect(f.state()).toBe("idle")
  })
})
