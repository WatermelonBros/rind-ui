// Segmented Control behaviour in Node (openspec segmented-control "Radio Semantics And
// Behaviour", "Selection Indicator"): its machine is radioGroupMachine, run with the props
// the SegmentedControl.Root passes (roving, looping, single selection).
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import {
  type RadioGroupEvent,
  type RadioGroupProps,
  radioGroupMachine,
} from "../radio-group/radio-group.machine"

const RANGES = ["day", "week", "month"]
const collectionOf = (disabled: string[] = []) =>
  createListCollection<{ id: string }>({
    items: RANGES.map((id) => ({ id })),
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => disabled.includes(i.id),
  })

function make(over: Partial<RadioGroupProps> = {}, disabled: string[] = []) {
  const onValueChange = vi.fn()
  let props: RadioGroupProps = {
    collection: collectionOf(disabled),
    strategy: "roving",
    ids: { list: "root", item: (k) => `item-${k}` },
    loop: true,
    selectionMode: "single",
    focusableWhenDisabled: false,
    onValueChange,
    disabled: false,
    readOnly: false,
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
  return {
    send,
    setProps: (p: Partial<RadioGroupProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    value: () => (s.view().values as { value?: string | null }).value ?? null,
    highlighted: () => s.view().context.highlightedKey,
    indicator: () => s.view().context.indicator,
    focus: (key: string) => send({ type: "FOCUS", key, modality: "keyboard" } as never),
    next: () => send({ type: "NAVIGATE", move: "next" }),
    prev: () => send({ type: "NAVIGATE", move: "previous" }),
    press: (key: string, modality: "pointer" | "touch" | "keyboard" | "virtual" = "pointer") =>
      send({ type: "PRESS", key, modality } as never),
    onValueChange,
  }
}

describe("arrows select", () => {
  it("an arrow focuses and selects in one step, reason NAVIGATE, wrapping at the ends", () => {
    const m = make({ defaultValue: "day" })
    m.focus("day")
    m.next()
    expect(m.highlighted()).toBe("week")
    expect(m.value()).toBe("week")
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("NAVIGATE")
    m.prev()
    m.prev()
    expect(m.value()).toBe("month")
    m.next()
    expect(m.value()).toBe("day")
  })

  it("skips a disabled segment", () => {
    const m = make({ defaultValue: "day" }, ["week"])
    m.focus("day")
    m.next()
    expect(m.value()).toBe("month")
  })
})

describe("focus does not select", () => {
  it("FOCUS highlights without a value change or a callback, with or without a selection", () => {
    for (const defaultValue of ["day", undefined]) {
      const m = make(defaultValue ? { defaultValue } : {})
      m.focus("month")
      expect(m.highlighted()).toBe("month")
      expect(m.value()).toBe(defaultValue ?? null)
      expect(m.onValueChange).not.toHaveBeenCalled()
    }
  })
})

describe("press", () => {
  it("selects with reason PRESS in every modality", () => {
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      const m = make()
      m.press("month", modality)
      expect(m.value(), modality).toBe("month")
      expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("PRESS")
    }
  })

  it("never deselects: pressing the selected segment keeps it and calls nothing", () => {
    const m = make({ defaultValue: "week" })
    m.press("week")
    expect(m.value()).toBe("week")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("ignores a disabled segment", () => {
    const m = make({}, ["week"])
    m.press("week")
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("read-only", () => {
  it("PRESS does not change the value", () => {
    const m = make({ readOnly: true, defaultValue: "day" })
    m.press("month")
    expect(m.value()).toBe("day")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("NAVIGATE moves the highlight but does not change the value", () => {
    const m = make({ readOnly: true, defaultValue: "day" })
    m.focus("day")
    m.next()
    expect(m.highlighted()).toBe("week")
    expect(m.value()).toBe("day")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("reset", () => {
  it("RESET restores the defaultValue", () => {
    const m = make({ defaultValue: "day" })
    m.press("month")
    expect(m.value()).toBe("month")
    m.send({ type: "RESET" })
    expect(m.value()).toBe("day")
  })

  it("without a default, back to nothing selected", () => {
    const m = make()
    m.press("month")
    m.send({ type: "RESET" })
    expect(m.value()).toBeNull()
  })

  it("controlled: proposes the default with reason RESET and does not apply it", () => {
    const m = make({ value: "month", defaultValue: "day" })
    m.send({ type: "RESET" })
    expect(m.value()).toBe("month")
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("day")
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("RESET")
  })
})

describe("INDICATOR.MEASURE", () => {
  const box = { left: 1, right: 11, top: 2, bottom: 12, width: 10, height: 10 }

  it("stores the box and the cause", () => {
    const m = make({ defaultValue: "week" })
    expect(m.indicator()).toBeNull()
    m.send({ type: "INDICATOR.MEASURE", box, cause: "layout" })
    expect(m.indicator()).toEqual({ box, cause: "layout" })
  })

  it("an identical box is not a change, whatever the cause", () => {
    const m = make({ defaultValue: "week" })
    m.send({ type: "INDICATOR.MEASURE", box, cause: "layout" })
    const first = m.indicator()
    m.send({ type: "INDICATOR.MEASURE", box: { ...box }, cause: "selection" })
    expect(m.indicator()).toBe(first)
  })

  it("a different box replaces it; a null box clears it", () => {
    const m = make({ defaultValue: "week" })
    m.send({ type: "INDICATOR.MEASURE", box, cause: "layout" })
    m.send({ type: "INDICATOR.MEASURE", box: { ...box, left: 5, right: 15 }, cause: "selection" })
    expect(m.indicator()).toEqual({ box: { ...box, left: 5, right: 15 }, cause: "selection" })
    m.send({ type: "INDICATOR.MEASURE", box: null, cause: "layout" })
    expect(m.indicator()).toBeNull()
  })

  it("measuring never touches the value", () => {
    const m = make({ defaultValue: "week" })
    m.send({ type: "INDICATOR.MEASURE", box, cause: "layout" })
    expect(m.value()).toBe("week")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})
