import { describe, expect, it } from "vitest"
import { createService, setup, type } from "../machine"
import type { FocusEvent, LogicalKeyEvent } from "./events"
import { isKeyboard, isKeyboardOrVirtual, notComposing } from "./guards"

type Event =
  | FocusEvent
  | LogicalKeyEvent
  | { type: "OPEN"; modality: "pointer" | "keyboard" | "virtual" | "touch" }

const machine = setup({
  types: type<{ props: object; events: Event; env: object }>(),
  guards: { isKeyboard, isKeyboardOrVirtual, notComposing },
}).machine({
  id: "g",
  initial: "idle",
  states: {
    idle: {
      on: {
        FOCUS: { target: "selected", guard: "isKeyboard" },
        OPEN: [{ target: "focusFirst", guard: "isKeyboardOrVirtual" }, { target: "open" }],
        ACTIVATE: { target: "submitted", guard: "notComposing" },
      },
    },
    selected: {},
    focusFirst: {},
    open: {},
    submitted: {},
  },
})

const key = (composing: boolean): LogicalKeyEvent => ({
  type: "ACTIVATE",
  modality: "keyboard",
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  mod: false,
  composing,
})

describe("modality guards inside a machine", () => {
  it("select-on-focus guarded on keyboard ignores a virtual FOCUS", () => {
    const s = createService(machine, {}, {})
    s.send({ type: "FOCUS", modality: "virtual", cause: "other" })
    expect(s.getSnapshot().state).toBe("idle")
    s.send({ type: "FOCUS", modality: "keyboard", cause: "key" })
    expect(s.getSnapshot().state).toBe("selected")
  })

  it("a virtual open takes the keyboard transition; a pointer open does not", () => {
    const virtual = createService(machine, {}, {})
    virtual.send({ type: "OPEN", modality: "virtual" })
    expect(virtual.getSnapshot().state).toBe("focusFirst")
    const pointer = createService(machine, {}, {})
    pointer.send({ type: "OPEN", modality: "pointer" })
    expect(pointer.getSnapshot().state).toBe("open")
  })

  it("notComposing blocks a composing Enter", () => {
    const s = createService(machine, {}, {})
    s.send(key(true))
    expect(s.getSnapshot().state).toBe("idle")
    s.send(key(false))
    expect(s.getSnapshot().state).toBe("submitted")
  })
})
