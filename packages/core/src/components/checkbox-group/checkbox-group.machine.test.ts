// The Checkbox Group machine in Node: the select-all cycle (controlled and uncontrolled),
// disabled items, proposals, reset and the registry.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  type CheckboxGroupEvent,
  type CheckboxGroupProps,
  checkboxGroupMachine,
} from "./checkbox-group.machine"

const ALL = ["a", "b", "c"]

function make(over: CheckboxGroupProps = {}) {
  const onValueChange = vi.fn()
  let props: CheckboxGroupProps = { allValues: ALL, onValueChange, ...over }
  const s = createService(checkboxGroupMachine, props as never, {} as never)
  s.start()
  const setProps = (p: Partial<CheckboxGroupProps>) => {
    props = { ...props, ...p }
    s.setProps(props as never)
  }
  const send = (e: CheckboxGroupEvent) => s.send(e as never)
  const value = () => [...((s.view().values as { value?: string[] }).value ?? [])]
  const proposals = () => onValueChange.mock.calls.map((c) => c[0] as string[])
  const parent = () => send({ type: "PARENT.TOGGLE", modality: "pointer" })
  const item = (v: string, checked: boolean) =>
    send({ type: "ITEM.TOGGLE", value: v, checked, modality: "pointer" })
  const register = (v: string, disabled = false, id = `id-${v}`) =>
    send({ type: "ITEM.REGISTER", value: v, id, disabled })
  const items = () => s.view().context.items
  /** A parent that applies every proposal. */
  const follow = () => onValueChange.mockImplementation((v: string[]) => setProps({ value: v }))
  return {
    s,
    onValueChange,
    setProps,
    send,
    value,
    proposals,
    parent,
    item,
    register,
    items,
    follow,
  }
}
const sorted = (v: readonly string[]) => [...v].sort()

describe("Parent cycle, uncontrolled", () => {
  it("full cycle: all, none, then the remembered partial selection", () => {
    const m = make({ defaultValue: ["a"] })
    m.parent()
    expect(sorted(m.value())).toEqual(ALL)
    m.parent()
    expect(m.value()).toEqual([])
    m.parent()
    expect(m.value()).toEqual(["a"])
  })

  it("already all selected: none", () => {
    const m = make({ defaultValue: ALL })
    m.parent()
    expect(m.value()).toEqual([])
  })

  it("from none with no partial memory: all", () => {
    const m = make({ defaultValue: [] })
    m.parent()
    expect(sorted(m.value())).toEqual(ALL)
    m.parent()
    expect(m.value()).toEqual([])
    // The remembered selection was empty, not partial: the cycle starts over with all.
    m.parent()
    expect(sorted(m.value())).toEqual(ALL)
  })

  it("an item toggle ends the cycle and becomes the memory", () => {
    const m = make({ defaultValue: ["a"] })
    m.parent()
    m.item("b", false)
    expect(sorted(m.value())).toEqual(["a", "c"])
    m.parent()
    expect(sorted(m.value())).toEqual(ALL)
    m.parent()
    expect(m.value()).toEqual([])
  })

  it("disabled items are never changed (base-ui#729)", () => {
    const m = make({ defaultValue: ["b"] })
    m.register("a")
    m.register("b", true)
    m.register("c", true)
    m.parent()
    expect(sorted(m.value())).toEqual(["a", "b"])
    m.parent()
    expect(m.value()).toEqual(["b"])
  })
})

describe("Parent cycle, controlled", () => {
  it("a parent applying every proposal gets all, none, remembered, all (base-ui#4552)", () => {
    const m = make({ value: ["a"] })
    m.follow()
    for (let i = 0; i < 4; i++) m.parent()
    expect(m.proposals().map(sorted)).toEqual([ALL, [], ["a"], ALL])
    expect(sorted(m.value())).toEqual(ALL)
  })

  it("a refused proposal ends the cycle ($reverted)", () => {
    const m = make({ value: ["a"] })
    m.parent()
    m.setProps({ value: ["a"] })
    expect(m.value()).toEqual(["a"])
    // The cycle restarted: a partial value selects all again, not none.
    m.parent()
    expect(sorted(m.proposals().at(-1) ?? [])).toEqual(ALL)
  })

  it("an item proposal waits for the parent; refusing keeps the value", () => {
    const m = make({ value: ["a"] })
    m.item("b", true)
    expect(m.proposals()).toEqual([["a", "b"]])
    expect(m.value()).toEqual(["a"])
    m.setProps({ value: ["a"] })
    expect(m.value()).toEqual(["a"])
    m.setProps({ value: ["a", "b"] })
    expect(m.value()).toEqual(["a", "b"])
  })
})

describe("callbacks and reasons", () => {
  it("one onValueChange per event, with the event as reason", () => {
    const m = make({ defaultValue: ["a"] })
    m.item("b", true)
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("ITEM.TOGGLE")
    m.parent()
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
    expect(m.onValueChange.mock.calls[1]?.[1].reason).toBe("PARENT.TOGGLE")
  })

  it("RESET restores the CURRENT defaultValue with reason RESET", () => {
    const m = make({ defaultValue: ["a"] })
    m.item("b", true)
    m.setProps({ defaultValue: ["c"] })
    m.onValueChange.mockClear()
    m.send({ type: "RESET" })
    expect(m.value()).toEqual(["c"])
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("RESET")
  })

  it("RESET with no default empties the group in one call", () => {
    const m = make()
    for (const v of ALL) m.item(v, true)
    m.onValueChange.mockClear()
    m.send({ type: "RESET" })
    expect(m.value()).toEqual([])
    expect(m.proposals()).toEqual([[]])
  })

  it.each([["readOnly"], ["disabled"]] as const)("a %s group ignores toggles", (flag) => {
    const m = make({ defaultValue: ["a"], [flag]: true })
    m.item("b", true)
    m.parent()
    expect(m.value()).toEqual(["a"])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("registry", () => {
  it("ITEM.REGISTER is idempotent", () => {
    const m = make()
    m.register("a")
    const first = m.items()
    m.register("a")
    expect(m.items()).toBe(first)
    m.register("a", true)
    expect(m.items()).not.toBe(first)
    expect(m.items().get("a")).toEqual({ id: "id-a", disabled: true })
  })

  it("ITEM.UNREGISTER with a stale id is ignored", () => {
    const m = make()
    m.register("a", false, "old")
    m.register("a", false, "new")
    m.send({ type: "ITEM.UNREGISTER", value: "a", id: "old" })
    expect(m.items().get("a")?.id).toBe("new")
    m.send({ type: "ITEM.UNREGISTER", value: "a", id: "new" })
    expect(m.items().has("a")).toBe(false)
  })
})
