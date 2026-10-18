// The Text Field machine in Node: composition, Clear guard, controlled proposals, the count
// announcement and the preset builder. Fake environment: a recording announcer.
import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import {
  buildTextFieldMachine,
  countAnnouncement,
  type TextFieldEvent,
  type TextFieldProps,
  textFieldMachine,
} from "./text-field.machine"
import { textFieldMessages } from "./text-field.messages"

function make(
  over: Partial<TextFieldProps> = {},
  machine: typeof textFieldMachine = textFieldMachine,
) {
  const log: Announcement[] = []
  const clearInput = vi.fn()
  const onValueChange = vi.fn()
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const props: TextFieldProps = {
    messages: textFieldMessages,
    id: "t1",
    clearInput,
    onValueChange,
    ...over,
  }
  const s = createService(machine, props as never, env as never)
  s.start()
  return {
    s,
    log,
    clearInput,
    onValueChange,
    state: () => s.getSnapshot().state,
    value: () => (s.view().values as Record<string, unknown>)["value"],
    send: (e: TextFieldEvent) => s.send(e as never),
    input: (value: string, composing = false, reason = "INPUT") =>
      s.send({ type: "INPUT", value, composing, reason, event: null } as never),
    focus: () => s.send({ type: "FOCUS", modality: "keyboard" } as never),
  }
}
const long = (n: number) => "x".repeat(n)

describe("composition", () => {
  it("never counts or announces while composing, reports each INPUT with composing details", () => {
    const m = make({ limit: 100 })
    m.focus()
    m.send({ type: "COMPOSITION.START" })
    expect(m.state()).toBe("composing")
    m.input(long(90), true)
    m.input(long(95), true)
    expect(m.log).toEqual([])
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
    const [value, details] = m.onValueChange.mock.calls[1] ?? []
    expect(value).toBe(long(95))
    expect(JSON.stringify(details)).toContain("INPUT")
    expect(m.value()).toBe(long(95))
  })

  it("COMPOSITION.END counts once with the committed value", () => {
    const m = make({ limit: 100 })
    m.focus()
    m.send({ type: "COMPOSITION.START" })
    m.input(long(80), true)
    m.send({ type: "COMPOSITION.END", value: long(90), event: null })
    expect(m.state()).toBe("idle")
    expect(m.log).toHaveLength(1)
    expect(m.log[0]?.message).toBe("10 characters remaining")
  })
})

describe("Clear", () => {
  it("calls clearInput(reason, true) when editable", () => {
    const m = make({ defaultValue: "abc" })
    m.send({ type: "CLEAR", modality: "pointer", reason: "CLEAR" })
    expect(m.clearInput).toHaveBeenCalledExactlyOnceWith("CLEAR", true)
  })

  it.each([
    ["disabled", { disabled: true }],
    ["readOnly", { readOnly: true }],
    ["focusableWhenDisabled", { focusableWhenDisabled: true }],
  ])("is refused when %s", (_n, over) => {
    const m = make({ defaultValue: "abc", ...over })
    m.send({ type: "CLEAR", modality: "pointer", reason: "CLEAR" })
    expect(m.clearInput).not.toHaveBeenCalled()
  })

  it("controlled: the clear is a proposal, the value stays until the parent applies it", () => {
    const m = make({ value: "abc" })
    m.send({ type: "CLEAR", modality: "pointer", reason: "CLEAR" })
    expect(m.value()).toBe("abc")
    m.input("", false, "CLEAR")
    expect(m.value()).toBe("abc")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("")
  })
})

describe("value", () => {
  it('null renders as empty string through the adapter; the machine value falls back to ""', () => {
    const m = make({ value: null })
    expect(m.value() ?? "").toBe("")
  })
  it("RESET records the re-read DOM value", () => {
    const m = make({ defaultValue: "a" })
    m.input("abc")
    m.send({ type: "RESET", value: "a" })
    expect(m.value()).toBe("a")
  })
})

describe("countAnnouncement", () => {
  const msg = textFieldMessages
  const c = (n: number, limit = 100, extra = {}) =>
    countAnnouncement(long(n), { limit, messages: msg, ...extra })
  it("threshold boundaries for max 100 (max(10, 20%) = 20)", () => {
    expect(c(79)).toBeNull()
    expect(c(80)).toBe("20 characters remaining")
    expect(c(85)).toBe("15 characters remaining")
    expect(c(50)).toBeNull()
    expect(c(99)).toBe("1 character remaining")
    expect(c(100)).toBe("0 characters remaining")
  })
  it("over the limit", () => {
    expect(c(120)).toBe("20 characters too many")
    expect(c(101)).toBe("1 character too many")
  })
  it("small limits use the floor of 10", () => {
    expect(c(40, 50)).toBe("10 characters remaining")
    expect(c(39, 50)).toBeNull()
  })
  it("no limit: never", () => expect(countAnnouncement("abc", { messages: msg })).toBeNull())
  it("an explicit threshold and a count override", () => {
    expect(c(94, 100, { threshold: 5 })).toBeNull()
    expect(c(95, 100, { threshold: 5 })).toBe("5 characters remaining")
    expect(c(1, 100, { count: () => 90 })).toBe("10 characters remaining")
  })
  it("a line break counts once", () => {
    expect(countAnnouncement("a\r\nb", { limit: 4, messages: msg, threshold: 1 })).toBe(
      "1 character remaining",
    )
  })
})

describe("count announcement through the machine", () => {
  it("only while focused; near the limit; keyed per field so a pause coalesces", () => {
    const m = make({ limit: 100 })
    m.input(long(95))
    expect(m.log).toEqual([])
    m.focus()
    m.input(long(50))
    expect(m.log).toEqual([])
    m.input(long(85))
    m.input(long(86))
    expect(m.log.map((a) => a.message)).toEqual([
      "15 characters remaining",
      "14 characters remaining",
    ])
    expect(new Set(m.log.map((a) => a.key))).toEqual(new Set(["text-field-t1-count"]))
    expect(m.log.every((a) => a.priority === "polite")).toBe(true)
  })
  it("over the limit announces the excess", () => {
    const m = make({ limit: 100 })
    m.focus()
    m.input(long(120))
    expect(m.log.at(-1)?.message).toBe("20 characters too many")
  })
})

describe("buildTextFieldMachine", () => {
  const graph = (m: typeof textFieldMachine) => {
    const def = m.def as unknown as {
      id: string
      initial: string
      on: Record<string, unknown>
      states: Record<string, { on: Record<string, unknown> }>
    }
    return {
      initial: def.initial,
      global: Object.keys(def.on).sort(),
      states: Object.fromEntries(
        Object.entries(def.states).map(([k, v]) => [k, Object.keys(v.on).sort()]),
      ),
    }
  }

  it("the empty preset is the Text Field: same states and events, scope text-field", () => {
    const built = buildTextFieldMachine({})
    expect(built.scope).toBe("text-field")
    expect(Object.keys(graph(built.machine).states)).toEqual(
      Object.keys(graph(textFieldMachine).states),
    )
    expect(Object.keys(graph(built.machine).states)).toEqual(["idle", "composing"])
    // The exported machine is the base plus the visibility and key preset.
    const base = Object.keys((built.machine.impl as { actions: object }).actions)
    const all = Object.keys((textFieldMachine.impl as { actions: object }).actions)
    expect(base.every((a) => all.includes(a))).toBe(true)
  })

  it("a preset global event with a controllable value is accepted while composing", () => {
    const { machine, scope } = buildTextFieldMachine({
      scope: "preset-a",
      values: { visible: { fallback: false } },
      events: { "VISIBILITY.TOGGLE": { actions: ["toggleVisible"] } },
      actions: {
        toggleVisible: ({ values, set }: never) =>
          (set as (k: string, v: unknown) => void)(
            "visible",
            !(values as Record<string, unknown>)["visible"],
          ),
      } as never,
    })
    expect(scope).toBe("preset-a")
    const m = make({}, machine as never)
    m.send({ type: "COMPOSITION.START" })
    expect(m.state()).toBe("composing")
    m.s.send({ type: "VISIBILITY.TOGGLE" } as never)
    expect(m.state()).toBe("composing")
    expect((m.s.view().values as Record<string, unknown>)["visible"]).toBe(true)
  })

  it("a preset can clear with its own reason (ESCAPE)", () => {
    const { machine } = buildTextFieldMachine({
      scope: "preset-b",
      events: { ESCAPE: { guard: "editable", actions: ["clearEscape"] } },
      actions: {
        clearEscape: ({ props }: { props: TextFieldProps }) => props.clearInput("ESCAPE", true),
      } as never,
    })
    const m = make({ defaultValue: "abc" }, machine as never)
    m.s.send({ type: "ESCAPE" } as never)
    expect(m.clearInput).toHaveBeenCalledExactlyOnceWith("ESCAPE", true)
    // The resulting INPUT carries the reason through to onValueChange.
    m.input("", false, "ESCAPE")
    expect(JSON.stringify(m.onValueChange.mock.calls[0]?.[1])).toContain("ESCAPE")
  })
})
