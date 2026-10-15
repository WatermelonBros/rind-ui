// The Radio Group machine in Node (openspec radio-group "Value", "Keyboard And Activation",
// "Disabled, Read-Only, Required And Invalid", "Form Participation").
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import {
  type RadioGroupEvent,
  type RadioGroupProps,
  radioGroupMachine,
} from "./radio-group.machine"

interface Item {
  readonly id: string
  readonly disabled?: boolean
}
const items = (...spec: (string | [string, boolean])[]): Item[] =>
  spec.map((s) => (typeof s === "string" ? { id: s } : { id: s[0], disabled: s[1] }))
const collectionOf = (list: Item[]) =>
  createListCollection<Item>({
    items: list,
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => i.disabled === true,
  })

function make(over: Partial<RadioGroupProps> = {}, list: Item[] = items("s", "m", "l")) {
  const onValueChange = vi.fn()
  let props: RadioGroupProps = {
    collection: collectionOf(list),
    strategy: "roving",
    ids: { list: "l", item: (k) => `i-${k}` },
    loop: true,
    selectionMode: "single",
    onValueChange,
    ...over,
  }
  const env = {
    dom: { getRootNode: () => document, getById: () => null, activeElement: () => null },
    clock: { now: () => 0 },
    layout: { pageTarget: () => null },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform: {},
    announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} },
    modality: {
      modality: () => "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const s = createService(radioGroupMachine, props as never, env as never)
  s.start()
  const send = (e: RadioGroupEvent) => s.send(e as never)
  const setProps = (p: Partial<RadioGroupProps>) => {
    props = { ...props, ...p }
    s.setProps(props as never)
  }
  const value = () => (s.view().values as { value?: string | null }).value ?? null
  const highlighted = () => s.view().context.highlightedKey
  const state = () => s.view().state
  const focus = (key: string, modality: "keyboard" | "pointer" | "virtual" = "keyboard") =>
    send({ type: "FOCUS", key, modality } as never)
  const next = () => send({ type: "NAVIGATE", move: "next" })
  const prev = () => send({ type: "NAVIGATE", move: "previous" })
  const press = (key: string, modality: "pointer" | "touch" | "keyboard" | "virtual" = "pointer") =>
    send({ type: "PRESS", key, modality } as never)
  return {
    s,
    send,
    setProps,
    value,
    highlighted,
    state,
    focus,
    next,
    prev,
    press,
    onValueChange,
  }
}

describe("keyboard navigation checks", () => {
  it("next from the focused radio focuses and checks it in one step", () => {
    const m = make({ defaultValue: "s" })
    m.focus("s")
    m.next()
    expect(m.highlighted()).toBe("m")
    expect(m.value()).toBe("m")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("m")
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("NAVIGATE")
  })

  it("previous goes back, and checks", () => {
    const m = make({ defaultValue: "m" })
    m.focus("m")
    m.prev()
    expect(m.highlighted()).toBe("s")
    expect(m.value()).toBe("s")
  })

  it("two moves in a row land on the third (radix#4094)", () => {
    const m = make({ defaultValue: "s" })
    m.focus("s")
    m.next()
    m.next()
    expect(m.highlighted()).toBe("l")
    expect(m.value()).toBe("l")
  })

  it("wraps at both ends", () => {
    const m = make({ defaultValue: "l" })
    m.focus("l")
    m.next()
    expect(m.value()).toBe("s")
    m.prev()
    expect(m.value()).toBe("l")
  })

  it("skips disabled radios", () => {
    const m = make({ defaultValue: "s" }, items("s", ["m", true], "l"))
    m.focus("s")
    m.next()
    expect(m.highlighted()).toBe("l")
    expect(m.value()).toBe("l")
    m.next()
    expect(m.value()).toBe("s")
  })

  it("all other radios disabled: nothing moves, nothing changes", () => {
    const m = make({ defaultValue: "s" }, items("s", ["m", true], ["l", true]))
    m.focus("s")
    m.next()
    expect(m.highlighted()).toBe("s")
    expect(m.value()).toBe("s")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("all disabled: focus-less navigation checks nothing", () => {
    const m = make({}, items(["s", true], ["m", true], ["l", true]))
    m.next()
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("focus never checks", () => {
  it("FOCUS (any modality) highlights without a value change (radix#938)", () => {
    for (const modality of ["keyboard", "pointer", "virtual"] as const) {
      const m = make({ defaultValue: "s" })
      m.focus("l", modality)
      expect(m.state()).toBe("focused")
      expect(m.highlighted()).toBe("l")
      expect(m.value()).toBe("s")
      expect(m.onValueChange).not.toHaveBeenCalled()
    }
  })

  it("FOCUS with nothing checked leaves the value empty", () => {
    const m = make()
    m.focus("m")
    expect(m.value()).toBeNull()
  })

  it("BLUR clears the highlight and returns to idle", () => {
    const m = make({ defaultValue: "s" })
    m.focus("l")
    expect(m.highlighted()).toBe("l")
    m.send({ type: "BLUR" })
    expect(m.state()).toBe("idle")
    expect(m.highlighted()).toBeNull()
    expect(m.value()).toBe("s")
  })
})

describe("press", () => {
  it("checks the pressed radio with reason PRESS", () => {
    const m = make()
    m.press("m")
    expect(m.value()).toBe("m")
    expect(m.highlighted()).toBe("m")
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("PRESS")
  })

  it("pressing the checked radio is a no-op: no callback (react-spectrum#4971)", () => {
    const m = make({ defaultValue: "m" })
    m.press("m")
    expect(m.value()).toBe("m")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a press on a disabled item is ignored", () => {
    const m = make({}, items("s", ["m", true], "l"))
    m.press("m")
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("every modality checks", () => {
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      const m = make()
      m.press("l", modality)
      expect(m.value(), modality).toBe("l")
    }
  })
})

describe("read-only and disabled", () => {
  it("read-only moves focus on navigation without checking (zag#2675)", () => {
    const m = make({ readOnly: true, defaultValue: "s" })
    m.focus("s")
    m.next()
    expect(m.highlighted()).toBe("m")
    expect(m.value()).toBe("s")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("read-only ignores presses", () => {
    const m = make({ readOnly: true, defaultValue: "s" })
    m.press("l")
    expect(m.value()).toBe("s")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a disabled group ignores presses and checks nothing on navigation", () => {
    const m = make({ disabled: true })
    m.press("l")
    m.focus("s")
    m.next()
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("value", () => {
  it("cancel() vetoes a change (uncontrolled)", () => {
    const onValueChange = vi.fn((_v: unknown, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultValue: "s", onValueChange })
    m.press("m")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(m.value()).toBe("s")
  })

  it("cancel() vetoes a keyboard move's check but focus still moves", () => {
    const onValueChange = vi.fn((_v: unknown, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultValue: "s", onValueChange })
    m.focus("s")
    m.next()
    expect(m.value()).toBe("s")
  })

  it("controlled: a proposal is not applied until the parent follows", () => {
    const m = make({ value: "s" })
    m.press("m")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.value()).toBe("s")
    m.setProps({ value: "m" })
    expect(m.value()).toBe("m")
  })

  it("controlled null clears the checked radio", () => {
    const m = make({ value: "m" })
    m.setProps({ value: null })
    expect(m.value()).toBeNull()
  })
})

describe("form reset", () => {
  it("uncontrolled: restores the defaultValue", () => {
    const m = make({ defaultValue: "s" })
    m.press("l")
    expect(m.value()).toBe("l")
    m.send({ type: "RESET" })
    expect(m.value()).toBe("s")
  })

  it("uncontrolled without a default: back to nothing checked", () => {
    const m = make()
    m.press("l")
    m.send({ type: "RESET" })
    expect(m.value()).toBeNull()
  })

  it("restores the CURRENT defaultValue", () => {
    const m = make({ defaultValue: "s" })
    m.setProps({ defaultValue: "m" })
    m.press("l")
    m.send({ type: "RESET" })
    expect(m.value()).toBe("m")
  })

  it("controlled: proposes the default with reason RESET and does not apply it", () => {
    const m = make({ value: "l", defaultValue: "s" })
    m.send({ type: "RESET" })
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("s")
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("RESET") // spec "Form Participation"
    expect(m.value()).toBe("l")
  })
})
