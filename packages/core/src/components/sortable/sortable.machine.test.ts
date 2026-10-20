// Sortable's rules in Node: keyboard moves by position (live, announced from the current
// order), Escape restores, quick moves, pointer drags reorder once on drop, disabled items stay,
// losing the source ends the session.
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { reorder, type SortableProps, sortableMachine } from "./sortable.machine"
import { sortableMessages } from "./sortable.messages"

function make(over: Partial<SortableProps> = {}) {
  const said: string[] = []
  const reasons: string[] = []
  let props: SortableProps = {
    id: "s",
    items: ["apple", "banana", "cherry"],
    labels: new Map([
      ["apple", "Apple"],
      ["banana", "Banana"],
      ["cherry", "Cherry"],
    ]),
    messages: sortableMessages,
    ...over,
  }
  const s = createService(sortableMachine, props, {
    announcer: {
      announce: (a: Announcement) => {
        said.push(a.message)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  })
  // The consumer applies each new order (controlled items).
  props = {
    ...props,
    onReorder: (keys, d) => {
      reasons.push(d.reason)
      props = { ...props, items: keys }
      s.setProps(props)
    },
  }
  s.setProps(props)
  s.start()
  const set = (next: Partial<SortableProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  return { s, said, reasons, set, items: () => props.items }
}

describe("reorder", () => {
  it("moves a key to an index of the result", () => {
    expect(reorder(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"])
    expect(reorder(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"])
    expect(reorder(["a", "b", "c"], "b", 9)).toEqual(["a", "c", "b"])
  })
})

describe("sortable machine", () => {
  it("keyboard: positions, live, announced from the current order (dnd-kit #1858)", () => {
    const t = make()
    t.s.send({ type: "PICK", key: "apple" })
    t.s.send({ type: "MOVE", by: 1 })
    t.s.send({ type: "MOVE", by: 1 })
    expect(t.items()).toEqual(["banana", "cherry", "apple"])
    expect(t.said.at(-1)).toBe("Position 3 of 3")
    // Past the end: nothing.
    t.s.send({ type: "MOVE", by: 1 })
    expect(t.items()).toEqual(["banana", "cherry", "apple"])
    t.s.send({ type: "DROP" })
    expect(t.said.at(-1)).toBe("Apple dropped at position 3 of 3")
    expect(t.s.view().state).toBe("idle")
  })

  it("Home / End", () => {
    const t = make()
    t.s.send({ type: "PICK", key: "cherry" })
    t.s.send({ type: "MOVE.TO", edge: "first" })
    expect(t.items()).toEqual(["cherry", "apple", "banana"])
  })

  it("Escape restores the order from the pick-up", () => {
    const t = make()
    t.s.send({ type: "PICK", key: "apple" })
    t.s.send({ type: "MOVE", by: 1 })
    t.s.send({ type: "MOVE", by: 1 })
    t.s.send({ type: "CANCEL" })
    expect(t.items()).toEqual(["apple", "banana", "cherry"])
    expect(t.reasons.at(-1)).toBe("cancel")
    expect(t.said.at(-1)).toBe("Apple returned to position 1 of 3")
  })

  it("quick moves one place without a pick-up", () => {
    const t = make()
    t.s.send({ type: "QUICK", key: "banana", by: -1 })
    expect(t.items()).toEqual(["banana", "apple", "cherry"])
    expect(t.s.view().state).toBe("idle")
    expect(t.said.at(-1)).toBe("Banana moved to position 1 of 3")
  })

  it("pointer: one reorder, on drop", () => {
    const t = make()
    t.s.send({ type: "DRAG.START", key: "apple" })
    t.s.send({ type: "DRAG.OVER", index: 1 })
    t.s.send({ type: "DRAG.OVER", index: 2 })
    expect(t.items()).toEqual(["apple", "banana", "cherry"])
    t.s.send({ type: "DRAG.END" })
    expect(t.items()).toEqual(["banana", "cherry", "apple"])
    expect(t.reasons).toEqual(["pointer"])
  })

  it("disabled items are not picked up, but can be passed", () => {
    const t = make({ disabledKeys: new Set(["banana"]) })
    t.s.send({ type: "PICK", key: "banana" })
    expect(t.s.view().state).toBe("idle")
    t.s.send({ type: "PICK", key: "apple" })
    t.s.send({ type: "MOVE", by: 1 })
    expect(t.items()).toEqual(["banana", "apple", "cherry"])
  })

  it("the active item leaving items ends the session (React Aria #10599)", () => {
    const t = make()
    t.s.send({ type: "PICK", key: "apple" })
    t.set({ items: ["apple", "cherry"] })
    expect(t.s.view().state).toBe("moving")
    t.set({ items: ["banana", "cherry"] })
    expect(t.s.view().state).toBe("idle")
    expect(t.s.view().context.active).toBeNull()
  })
})
