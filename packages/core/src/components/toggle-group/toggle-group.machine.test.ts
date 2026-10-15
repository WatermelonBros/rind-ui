// The Toggle Group machine in Node (openspec toggle-group "Value And Selection Modes",
// "Keyboard And Activation", "Disabled Items").
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import {
  type ToggleGroupEvent,
  type ToggleGroupProps,
  toggleGroupMachine,
} from "./toggle-group.machine"

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

function make(over: Partial<ToggleGroupProps> = {}, list: Item[] = items("a", "b", "c", "d")) {
  const onValueChange = vi.fn()
  let props: ToggleGroupProps = {
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
  const s = createService(toggleGroupMachine, props as never, env as never)
  s.start()
  const send = (e: ToggleGroupEvent) => s.send(e as never)
  return {
    send,
    setProps: (p: Partial<ToggleGroupProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    value: () => (s.view().values as { value?: string[] }).value ?? [],
    highlighted: () => s.view().context.highlightedKey,
    state: () => s.view().state,
    focus: (key: string, modality: "keyboard" | "pointer" | "virtual" = "keyboard") =>
      send({ type: "FOCUS", key, modality } as never),
    nav: (move: "next" | "previous" | "first" | "last") => send({ type: "NAVIGATE", move }),
    press: (key: string, modality: "pointer" | "touch" | "keyboard" | "virtual" = "pointer") =>
      send({ type: "PRESS", key, modality } as never),
    onValueChange,
  }
}

describe("single mode", () => {
  it("pressing replaces the selection", () => {
    const m = make({ defaultValue: ["a"] })
    m.press("b")
    expect(m.value()).toEqual(["b"])
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("PRESS")
  })

  it("pressing the pressed item deselects it (reka-ui#992)", () => {
    const m = make()
    m.press("a")
    m.press("a")
    expect(m.value()).toEqual([])
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
  })

  it("disallowEmptySelection keeps the only pressed item and does not call back", () => {
    const m = make({ defaultValue: ["a"], disallowEmptySelection: true })
    m.press("a")
    expect(m.value()).toEqual(["a"])
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.press("b")
    expect(m.value()).toEqual(["b"])
  })
})

describe("multiple mode", () => {
  it("adds and removes, in document order", () => {
    const m = make({ selectionMode: "multiple" })
    m.press("c")
    m.press("a")
    expect(m.value()).toEqual(["a", "c"])
    m.press("c")
    expect(m.value()).toEqual(["a"])
  })

  it("disallowEmptySelection keeps the last one but releases others", () => {
    const m = make({
      selectionMode: "multiple",
      defaultValue: ["a", "b"],
      disallowEmptySelection: true,
    })
    m.press("a")
    expect(m.value()).toEqual(["b"])
    m.press("b")
    expect(m.value()).toEqual(["b"])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("deselecting the only one works when empty is allowed", () => {
    const m = make({ selectionMode: "multiple", defaultValue: ["a"] })
    m.press("a")
    expect(m.value()).toEqual([])
  })
})

describe("disabled", () => {
  it("a disabled item is never added", () => {
    for (const selectionMode of ["single", "multiple"] as const) {
      const m = make({ selectionMode }, items("a", ["b", true], "c"))
      m.press("b")
      expect(m.value(), selectionMode).toEqual([])
      expect(m.onValueChange).not.toHaveBeenCalled()
    }
  })

  it("a disabled group ignores PRESS", () => {
    const m = make({ disabled: true, defaultValue: ["a"] })
    m.press("b")
    m.press("a")
    expect(m.value()).toEqual(["a"])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("navigation", () => {
  it("never changes the value", () => {
    const m = make({ defaultValue: ["a"] })
    m.focus("a")
    for (const move of ["next", "next", "previous", "last", "first"] as const) m.nav(move)
    expect(m.value()).toEqual(["a"])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("moves next, previous, first and last, wrapping with loop", () => {
    const m = make()
    m.focus("a")
    m.nav("next")
    expect(m.highlighted()).toBe("b")
    m.nav("last")
    expect(m.highlighted()).toBe("d")
    m.nav("next")
    expect(m.highlighted()).toBe("a")
    m.nav("previous")
    expect(m.highlighted()).toBe("d")
    m.nav("first")
    expect(m.highlighted()).toBe("a")
  })

  it("does not wrap without loop", () => {
    const m = make({ loop: false })
    m.focus("d")
    m.nav("next")
    expect(m.highlighted()).toBe("d")
  })

  it("skips a disabled item", () => {
    const m = make({}, items("a", ["b", true], "c"))
    m.focus("a")
    m.nav("next")
    expect(m.highlighted()).toBe("c")
  })
})

describe("value control", () => {
  it("cancel() vetoes the change", () => {
    const onValueChange = vi.fn((_v: unknown, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultValue: ["a"], onValueChange })
    m.press("b")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(m.value()).toEqual(["a"])
  })

  it("controlled: one proposal, applied only when the parent follows (radix#721)", () => {
    const m = make({ value: ["a"] })
    m.press("a")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[0]).toEqual([])
    expect(m.value()).toEqual(["a"])
    m.setProps({ value: [] })
    expect(m.value()).toEqual([])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("controlled: a refused proposal leaves the value", () => {
    const m = make({ value: ["a"] })
    m.press("b")
    m.press("c")
    expect(m.value()).toEqual(["a"])
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
  })
})

describe("focus", () => {
  it("FOCUS highlights without pressing and enters focused", () => {
    const m = make()
    m.focus("b")
    expect(m.state()).toBe("focused")
    expect(m.highlighted()).toBe("b")
    expect(m.value()).toEqual([])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("BLUR clears the highlight and returns to idle (zag#2190)", () => {
    const m = make({ defaultValue: ["a"] })
    m.focus("b")
    m.send({ type: "BLUR" })
    expect(m.state()).toBe("idle")
    expect(m.highlighted()).toBeNull()
    expect(m.value()).toEqual(["a"])
  })
})
