// Accordion part props (spec "Styling Attributes", "Panel Region Rule", "Keyboard") in Node.
import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import {
  type AccordionConnectInput,
  accordionConnect,
  type TriggerKeyEvent,
} from "./accordion.connect"
import { type AccordionEvent, itemKey } from "./accordion.machine"

const A = itemKey("A")
const item = (over: { open?: boolean; disabled?: boolean } = {}) => ({
  item: A,
  open: false,
  disabled: false,
  ...over,
})

function make(over: Partial<AccordionConnectInput> = {}) {
  const send = vi.fn<(e: AccordionEvent) => void>()
  const input: AccordionConnectInput = {
    instance: "i1",
    orientation: "vertical",
    dir: "ltr",
    platform: platforms.linux,
    disabled: false,
    multiple: false,
    collapsible: true,
    keyboardNavigation: false,
    itemCount: 3,
    contentRole: undefined,
    ...over,
  }
  return { c: accordionConnect(input, send), send }
}
const attr = (props: object, name: string) => (props as Record<string, unknown>)[name]

function keyEvent(key: string, over: Partial<TriggerKeyEvent> = {}) {
  const preventDefault = vi.fn()
  const e: TriggerKeyEvent = {
    key,
    code: key,
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
    repeat: false,
    composing: false,
    onTrigger: true,
    preventDefault,
    ...over,
  }
  return { e, preventDefault }
}
const press = (
  m: ReturnType<typeof make>,
  key: string,
  over: Partial<TriggerKeyEvent> = {},
  s = item(),
) => {
  const k = keyEvent(key, over)
  ;(attr(m.c.trigger(s), "onKeyDown") as (e: TriggerKeyEvent) => void)(k.e)
  return k
}

describe("styling attributes", () => {
  it("root", () => {
    const p = make().c.root()
    expect(p).toMatchObject({
      "data-scope": "accordion",
      "data-part": "root",
      "data-instance": "i1",
      "data-orientation": "vertical",
    })
    expect(attr(p, "data-disabled")).toBeUndefined()
    expect(attr(make({ disabled: true }).c.root(), "data-disabled")).toBe("")
    expect(attr(make({ orientation: "horizontal" }).c.root(), "data-orientation")).toBe(
      "horizontal",
    )
  })

  it("item and header: scope, state, disabled, orientation", () => {
    const { c } = make({ orientation: "horizontal" })
    for (const [part, p] of [
      ["item", c.item(item())],
      ["header", c.header(item(), 3, "h3")],
    ] as const) {
      expect(p).toMatchObject({
        "data-scope": "accordion",
        "data-part": part,
        "data-instance": "i1",
        "data-state": "closed",
        "data-orientation": "horizontal",
      })
      expect(attr(p, "data-disabled")).toBeUndefined()
    }
    const open = c.item(item({ open: true, disabled: true }))
    expect(attr(open, "data-state")).toBe("open")
    expect(attr(open, "data-disabled")).toBe("")
    expect(attr(c.header(item({ open: true, disabled: true }), 3, "h3"), "data-disabled")).toBe("")
  })

  it("trigger and content and indicator carry data-orientation", () => {
    const { c } = make({ orientation: "horizontal" })
    expect(attr(c.trigger(item()), "data-orientation")).toBe("horizontal")
    expect(attr(c.content(item(), "t1"), "data-orientation")).toBe("horizontal")
    expect(attr(c.indicator(), "data-orientation")).toBe("horizontal")
  })

  it("an item's own disabled is not the lock", () => {
    const { c } = make({ collapsible: false })
    const s = item({ open: true })
    expect(attr(c.trigger(s), "data-disabled")).toBe("")
    expect(attr(c.item(s), "data-disabled")).toBeUndefined()
    expect(attr(c.header(s, 3, "h3"), "data-disabled")).toBeUndefined()
  })
})

describe("lock", () => {
  it("only the open trigger of a non-collapsible single accordion", () => {
    const locked = make({ collapsible: false }).c
    const t = locked.trigger(item({ open: true }))
    expect(attr(t, "aria-disabled")).toBe("true")
    expect(attr(t, "data-disabled")).toBe("")
    expect(attr(locked.trigger(item()), "aria-disabled")).toBeUndefined()
    expect(attr(locked.trigger(item()), "data-disabled")).toBeUndefined()
  })

  it("not in collapsible or multiple mode", () => {
    for (const over of [{ collapsible: true }, { multiple: true, collapsible: false }]) {
      const t = make(over).c.trigger(item({ open: true }))
      expect(attr(t, "aria-disabled")).toBeUndefined()
      expect(attr(t, "data-disabled")).toBeUndefined()
    }
  })
})

describe("header", () => {
  it("native h3: no role, no aria-level", () => {
    const p = make().c.header(item(), 3, "h3")
    expect(attr(p, "role")).toBeUndefined()
    expect(attr(p, "aria-level")).toBeUndefined()
  })

  it("div: role heading and aria-level", () => {
    const p = make().c.header(item(), 3, "div")
    expect(attr(p, "role")).toBe("heading")
    expect(attr(p, "aria-level")).toBe("3")
  })

  it("level 2 on h2 is native", () => {
    const p = make().c.header(item(), 2, "h2")
    expect(attr(p, "role")).toBeUndefined()
    expect(attr(p, "aria-level")).toBeUndefined()
  })
})

describe("region rule", () => {
  const role = (over: Partial<AccordionConnectInput>, open = true) => {
    const p = make(over).c.content(item({ open }), "t1")
    return [attr(p, "role"), attr(p, "aria-labelledby")]
  }

  it("single mode with 10 items is a region", () => {
    expect(role({ itemCount: 10 })).toEqual(["region", "t1"])
  })
  it("multiple with up to 6 items is a region", () => {
    expect(role({ multiple: true, itemCount: 6 })).toEqual(["region", "t1"])
  })
  it("multiple with 8 items has no role", () => {
    expect(role({ multiple: true, itemCount: 8 })).toEqual([undefined, undefined])
  })
  it("contentRole overrides the rule both ways", () => {
    expect(role({ multiple: true, itemCount: 8, contentRole: "region" })).toEqual(["region", "t1"])
    expect(role({ itemCount: 2, contentRole: "none" })).toEqual([undefined, undefined])
  })
  it("closed content never has a role or aria-labelledby", () => {
    expect(role({ itemCount: 2 }, false)).toEqual([undefined, undefined])
    expect(role({ contentRole: "region" }, false)).toEqual([undefined, undefined])
    expect(attr(make().c.content(item(), "t1"), "aria-hidden")).toBeUndefined()
  })
})

describe("trigger keyboard", () => {
  it("does nothing without keyboardNavigation", () => {
    const m = make()
    const k = press(m, "ArrowDown")
    expect(m.send).not.toHaveBeenCalled()
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores events not on the trigger", () => {
    const m = make({ keyboardNavigation: true })
    const k = press(m, "ArrowDown", { onTrigger: false })
    expect(m.send).not.toHaveBeenCalled()
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores composing", () => {
    const m = make({ keyboardNavigation: true })
    press(m, "Home", { composing: true })
    expect(m.send).not.toHaveBeenCalled()
  })

  it("vertical: ArrowDown/ArrowUp, Home, End", () => {
    const m = make({ keyboardNavigation: true })
    const k = press(m, "ArrowDown")
    press(m, "ArrowUp")
    press(m, "Home")
    press(m, "End")
    expect(m.send.mock.calls.map((c) => c[0])).toEqual([
      { type: "FOCUS.NEXT", from: A },
      { type: "FOCUS.PREV", from: A },
      { type: "FOCUS.FIRST", from: A },
      { type: "FOCUS.LAST", from: A },
    ])
    expect(k.preventDefault).toHaveBeenCalledTimes(1)
  })

  it("vertical: horizontal arrows are not consumed", () => {
    const m = make({ keyboardNavigation: true })
    const k = press(m, "ArrowRight")
    expect(m.send).not.toHaveBeenCalled()
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("horizontal rtl: ArrowLeft is NEXT, ArrowRight is PREV, ArrowDown is not consumed", () => {
    const m = make({ keyboardNavigation: true, orientation: "horizontal", dir: "rtl" })
    press(m, "ArrowLeft")
    press(m, "ArrowRight")
    const k = press(m, "ArrowDown")
    expect(m.send.mock.calls.map((c) => c[0].type)).toEqual(["FOCUS.NEXT", "FOCUS.PREV"])
    expect(k.preventDefault).not.toHaveBeenCalled()
  })

  it("Enter and Space are left to the Collapsible press, not consumed", () => {
    const m = make({ keyboardNavigation: true })
    const k1 = press(m, "Enter")
    const k2 = press(m, " ")
    expect(m.send).not.toHaveBeenCalled()
    expect(k1.preventDefault).not.toHaveBeenCalled()
    expect(k2.preventDefault).not.toHaveBeenCalled()
  })
})
