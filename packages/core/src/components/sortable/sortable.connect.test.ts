import { describe, expect, it } from "vitest"
import { type SortableConnectInput, sortableConnect } from "./sortable.connect"
import { sortableContract } from "./sortable.contract"
import { sortableMachine } from "./sortable.machine"
import { sortableMessages } from "./sortable.messages"
import { sortableMeta } from "./sortable.meta"

const input = (over: Partial<SortableConnectInput> = {}): SortableConnectInput => ({
  instance: "s",
  state: "moving",
  items: ["apple", "banana", "cherry"],
  orientation: "vertical",
  active: "apple",
  disabled: (k) => k === "cherry",
  label: (k) => k[0]?.toUpperCase() + k.slice(1),
  drag: null,
  ids: { instructions: "s-ins" },
  messages: sortableMessages,
  ...over,
})

describe("sortable connect", () => {
  it("the handle: a named button, described, pressed while picked up", () => {
    const a = sortableConnect(input())
    expect(a.handle("apple")).toMatchObject({
      type: "button",
      "aria-label": "Reorder Apple",
      "aria-describedby": "s-ins",
      "aria-pressed": "true",
    })
    expect(a.handle("banana")["aria-pressed"]).toBe("false")
    expect(a.handle("cherry")["aria-disabled"]).toBe("true")
  })

  it("move buttons are aria-disabled at the ends", () => {
    const a = sortableConnect(input())
    expect(a.moveButton("apple", "up")["aria-disabled"]).toBe("true")
    expect(a.moveButton("apple", "down")).toMatchObject({ "aria-label": "Move Apple down" })
    expect(a.moveButton("apple", "down")["aria-disabled"]).toBeUndefined()
  })

  it("a pointer drag offsets the active item and shows the indicator", () => {
    const a = sortableConnect(
      input({ state: "dragging", drag: { delta: { x: 0, y: 30 }, indicator: 80 } }),
    )
    expect(a.item("apple")["data-dragging"]).toBe("")
    expect((a.item("apple")["style"] as Record<string, string>)["--rind-sortable-y"]).toBe("30px")
    expect((a.indicator()["style"] as Record<string, string>)["--rind-sortable-indicator"]).toBe(
      "80px",
    )
  })
})

describe("sortable meta matches the code", () => {
  it("contract, states and data attributes", () => {
    expect(sortableMeta.contract.queries).toEqual(Object.keys(sortableContract.queries))
    expect(Object.keys(sortableMeta.states)).toEqual(Object.keys(sortableMachine.def.states))
    const actions = Object.fromEntries(
      Object.entries(sortableContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(sortableMeta.contract.actions).toEqual(actions)
    const drag = sortableConnect(
      input({ state: "dragging", drag: { delta: { x: 0, y: 0 }, indicator: 0 } }),
    )
    const off = sortableConnect(input({ drag: null }))
    const parts = {
      root: drag.root(),
      item: { ...drag.item("apple"), "data-disabled": "" },
      handle: {
        ...drag.handle("apple", { focused: true, modality: "keyboard" }),
        "data-disabled": "",
      },
      indicator: off.indicator(),
      "move-button": drag.moveButton("apple", "up"),
    }
    for (const [name, props] of Object.entries(parts)) {
      const keys = Object.keys(props)
        .filter((k) => k.startsWith("data-") && (props as Record<string, unknown>)[k] !== undefined)
        .sort()
      const meta = sortableMeta.dataAttributes[name as keyof typeof sortableMeta.dataAttributes]
      expect(Object.keys(meta).sort(), name).toEqual(keys)
    }
  })
})
