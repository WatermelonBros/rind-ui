// The Accordion machine in Node: value modes, the lock, disabled items, controlled
// proposals, the single-mode trim and the optional trigger navigation.
import { afterEach, describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  type AccordionEvent,
  type AccordionProps,
  accordionMachine,
  type ItemKey,
  itemKey,
  openKeysOf,
} from "./accordion.machine"

const A = itemKey("A")
const B = itemKey("B")
const C = itemKey("C")

function make(over: Partial<AccordionProps> = {}, items: readonly ItemKey[] = [A, B, C]) {
  const onValueChange = vi.fn()
  const focusTrigger = vi.fn()
  let props: AccordionProps = { onValueChange, focusTrigger, ...over }
  const s = createService(accordionMachine, props as never, {} as never)
  s.start()
  const send = (e: AccordionEvent) => s.send(e as never)
  for (const item of items) send({ type: "ITEM.REGISTER", item, disabled: false, focusable: true })
  return {
    s,
    onValueChange,
    focusTrigger,
    send,
    value: () => (s.view().values as Record<string, unknown>)["value"],
    items: () => (s.getSnapshot().context as { items: ReadonlyMap<ItemKey, unknown> }).items,
    setProps: (p: Partial<AccordionProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}
const toggle = (item: ItemKey): AccordionEvent => ({
  type: "ITEM.TOGGLE",
  item,
  modality: "pointer",
})
const open = (item: ItemKey, reason: "api" | "find-in-page" = "api"): AccordionEvent => ({
  type: "ITEM.OPEN",
  item,
  reason,
})
const close = (item: ItemKey): AccordionEvent => ({ type: "ITEM.CLOSE", item, reason: "api" })

afterEach(() => vi.restoreAllMocks())

describe("TOGGLE matrix", () => {
  it.each([true, false, undefined])("single, collapsible %s: opening replaces", (collapsible) => {
    const m = make({ collapsible })
    m.send(toggle(A))
    expect(m.value()).toEqual(["A"])
    m.send(toggle(B))
    expect(m.value()).toEqual(["B"])
    expect(m.onValueChange.mock.calls[1]?.[0]).toEqual(["B"])
  })

  it.each([true, undefined])("single, collapsible %s: toggling the open item closes it", (c) => {
    const m = make({ collapsible: c })
    m.send(toggle(A))
    m.send(toggle(A))
    expect(m.value()).toEqual([])
    expect(m.onValueChange.mock.calls[1]?.[0]).toEqual([])
  })

  it("single, collapsible false: toggling the open item does nothing and reports nothing", () => {
    const m = make({ collapsible: false })
    m.send(toggle(A))
    m.onValueChange.mockClear()
    m.send(toggle(A))
    expect(m.value()).toEqual(["A"])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it.each([true, false, undefined])("multiple, collapsible %s: adds and removes", (collapsible) => {
    const m = make({ multiple: true, collapsible })
    m.send(toggle(A))
    m.send(toggle(B))
    expect(m.value()).toEqual(["A", "B"])
    m.send(toggle(A))
    expect(m.value()).toEqual(["B"])
    m.send(toggle(B))
    expect(m.value()).toEqual([])
  })

  it("reports each change with its event", () => {
    const m = make()
    m.send(toggle(A))
    expect(m.onValueChange.mock.calls[0]?.[1].event).toMatchObject({ type: "ITEM.TOGGLE", item: A })
  })

  it('value "0" works (radix#2937)', () => {
    const m = make({}, [itemKey("0"), A])
    m.send(toggle(itemKey("0")))
    expect(m.value()).toEqual(["0"])
    m.send(toggle(itemKey("0")))
    expect(m.value()).toEqual([])
  })

  it("an empty item value is rejected", () => {
    expect(() => itemKey("")).toThrow()
  })
})

describe("ITEM.OPEN / ITEM.CLOSE", () => {
  it.each(["api", "find-in-page"] as const)("%s in single mode replaces the open item", (r) => {
    const m = make()
    m.send(toggle(A))
    m.send(open(B, r))
    expect(m.value()).toEqual(["B"])
    expect(m.onValueChange.mock.calls[1]?.[1].event).toMatchObject({ type: "ITEM.OPEN", reason: r })
  })

  it("is never refused by the lock", () => {
    const m = make({ collapsible: false })
    m.send(toggle(A))
    m.send(open(B, "find-in-page"))
    expect(m.value()).toEqual(["B"])
  })

  it("multiple adds", () => {
    const m = make({ multiple: true })
    m.send(open(A))
    m.send(open(B))
    expect(m.value()).toEqual(["A", "B"])
  })

  it("is ignored when already open", () => {
    const m = make()
    m.send(toggle(A))
    m.onValueChange.mockClear()
    m.send(open(A))
    m.send(open(A, "find-in-page"))
    expect(m.value()).toEqual(["A"])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("CLOSE closes an open item", () => {
    const m = make()
    m.send(toggle(A))
    m.send(close(A))
    expect(m.value()).toEqual([])
  })

  it("CLOSE of a closed item is ignored", () => {
    const m = make()
    m.send(close(A))
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("CLOSE is refused by the lock", () => {
    const m = make({ collapsible: false })
    m.send(toggle(A))
    m.send(close(A))
    expect(m.value()).toEqual(["A"])
  })

  it("CLOSE in multiple mode ignores collapsible", () => {
    const m = make({ multiple: true, collapsible: false })
    m.send(open(A))
    m.send(close(A))
    expect(m.value()).toEqual([])
  })
})

describe("disabled", () => {
  it("root disabled ignores TOGGLE", () => {
    const m = make({ disabled: true })
    m.send(toggle(A))
    expect(m.value()).toEqual([])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("root disabled does not change what is open", () => {
    const m = make({ defaultValue: ["A"] })
    m.setProps({ disabled: true })
    m.send(toggle(A))
    expect(m.value()).toEqual(["A"])
  })

  it("a disabled item ignores TOGGLE, an enabled one does not", () => {
    const m = make({}, [])
    m.send({ type: "ITEM.REGISTER", item: A, disabled: true, focusable: false })
    m.send({ type: "ITEM.REGISTER", item: B, disabled: false, focusable: true })
    m.send(toggle(A))
    expect(m.value()).toEqual([])
    m.send(toggle(B))
    expect(m.value()).toEqual(["B"])
  })

  it("re-registering with disabled applies from the next interaction", () => {
    const m = make()
    m.send({ type: "ITEM.REGISTER", item: A, disabled: true, focusable: false })
    m.send(toggle(A))
    expect(m.value()).toEqual([])
  })
})

describe("registry", () => {
  it("register and unregister update context.items", () => {
    const m = make({}, [])
    m.send({ type: "ITEM.REGISTER", item: A, disabled: true, focusable: false })
    expect(m.items().get(A)).toEqual({ disabled: true, focusable: false })
    m.send({ type: "ITEM.UNREGISTER", item: A })
    expect(m.items().has(A)).toBe(false)
  })
})

describe("controlled value", () => {
  it("proposes through onValueChange and keeps the value on refusal", () => {
    const m = make({ value: [] })
    m.send(toggle(A))
    expect(m.onValueChange.mock.calls[0]?.[0]).toEqual(["A"])
    expect(m.onValueChange.mock.calls[0]?.[1].event).toMatchObject({ type: "ITEM.TOGGLE" })
    expect(m.value()).toEqual([])
  })

  it("follows the parent when it applies the proposal", () => {
    const m = make({ value: [] })
    m.send(toggle(A))
    m.setProps({ value: ["A"] })
    expect(m.value()).toEqual(["A"])
    m.send(toggle(B))
    expect(m.onValueChange.mock.calls[1]?.[0]).toEqual(["B"])
  })

  it("controlled -> undefined warns once and stays controlled; [] closes all", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const m = make({ value: ["A"] })
    m.setProps({ value: undefined })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("controlled")
    expect(m.value()).toEqual(["A"])
    m.setProps({ value: [] })
    expect(m.value()).toEqual([])
  })
})

describe("openKeysOf", () => {
  it("single mode trims to the first key and warns once per value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const v = ["x", "y"]
    expect(openKeysOf(v, false)).toEqual(["x"])
    expect(openKeysOf(v, undefined)).toEqual(["x"])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("multiple")
  })

  it("multiple keeps everything, silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(openKeysOf(["x", "y"], true)).toEqual(["x", "y"])
    expect(openKeysOf(["x"], false)).toEqual(["x"])
    expect(openKeysOf([], false)).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it("a multi-key value in single mode treats only the first as open", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const m = make({ value: ["B", "C"] })
    m.send(toggle(C))
    expect(m.onValueChange.mock.calls[0]?.[0]).toEqual(["C"])
    m.send(toggle(B))
    expect(m.onValueChange.mock.calls[1]?.[0]).toEqual([])
  })
})

describe("focus moves", () => {
  const next = (from: ItemKey): AccordionEvent => ({ type: "FOCUS.NEXT", from })
  const prev = (from: ItemKey): AccordionEvent => ({ type: "FOCUS.PREV", from })
  const first = (from: ItemKey): AccordionEvent => ({ type: "FOCUS.FIRST", from })
  const last = (from: ItemKey): AccordionEvent => ({ type: "FOCUS.LAST", from })

  it("does nothing without keyboardNavigation", () => {
    const m = make()
    for (const e of [next(A), prev(A), first(B), last(B)]) m.send(e)
    expect(m.focusTrigger).not.toHaveBeenCalled()
  })

  it("moves and wraps", () => {
    const m = make({ keyboardNavigation: true })
    m.send(next(A))
    m.send(next(C))
    m.send(prev(A))
    m.send(prev(B))
    m.send(first(C))
    m.send(last(A))
    expect(m.focusTrigger.mock.calls.map((c) => c[0])).toEqual(["B", "A", "C", "A", "A", "C"])
  })

  it("uses triggerOrder, not registration order", () => {
    const triggerOrder = vi.fn((keys: readonly ItemKey[]) => [...keys].reverse())
    const m = make({ keyboardNavigation: true, triggerOrder })
    m.send(next(A)) // order: C B A -> wraps to C
    m.send(first(A))
    m.send(last(A))
    m.send(prev(A)) // wraps to B
    expect(m.focusTrigger.mock.calls.map((c) => c[0])).toEqual(["C", "C", "A", "B"])
    expect(triggerOrder).toHaveBeenCalledWith([A, B, C])
  })

  it("skips items registered focusable:false", () => {
    const m = make({ keyboardNavigation: true }, [])
    m.send({ type: "ITEM.REGISTER", item: A, disabled: false, focusable: true })
    m.send({ type: "ITEM.REGISTER", item: B, disabled: true, focusable: false })
    m.send({ type: "ITEM.REGISTER", item: C, disabled: false, focusable: true })
    m.send(next(A))
    m.send(prev(C))
    m.send(last(A))
    expect(m.focusTrigger.mock.calls.map((c) => c[0])).toEqual(["C", "A", "C"])
  })

  it("focuses a locked or focusable-when-disabled item (focusable:true)", () => {
    const m = make({ keyboardNavigation: true }, [])
    m.send({ type: "ITEM.REGISTER", item: A, disabled: false, focusable: true })
    m.send({ type: "ITEM.REGISTER", item: B, disabled: true, focusable: true })
    m.send(next(A))
    expect(m.focusTrigger).toHaveBeenCalledWith("B")
  })

  it("does not change the value", () => {
    const m = make({ keyboardNavigation: true })
    m.send(next(A))
    expect(m.value()).toEqual([])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})
