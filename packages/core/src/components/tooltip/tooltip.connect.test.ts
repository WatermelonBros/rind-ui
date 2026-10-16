// The Tooltip's attributes (openspec add-tooltip): "Data Attributes", "Description And Label
// Wiring", "Not Focusable, Not Interactive", "Composition With Other Triggers" (connect never
// prevents default or stops propagation), "Anatomy" scoping.
import { describe, expect, it, vi } from "vitest"
import { CRITICAL } from "../../connect/props"
import type { PlacementState } from "../../dom/position/connect"
import { type TooltipConnectInput, tooltipConnect } from "./tooltip.connect"
import { tooltipIds } from "./tooltip.machine"

const placed: PlacementState = { placed: true, side: "bottom", align: "start", anchorHidden: false }
const base: TooltipConnectInput = {
  instance: "r",
  open: true,
  instant: false,
  placement: placed,
  type: "description",
  contentMounted: true,
}
const hoverProps = { onPointerMove: vi.fn(), onPointerLeave: vi.fn() }
const api = (over: Partial<TooltipConnectInput> = {}, send = vi.fn()) =>
  tooltipConnect({ ...base, ...over }, send)
const state = (over = {}) => ({
  focused: false,
  hovered: false,
  modality: "pointer" as const,
  ...over,
})
const trigger = (over: Partial<TooltipConnectInput> = {}, s = {}) =>
  api(over).trigger(state(s), hoverProps)
const content = (over: Partial<TooltipConnectInput> = {}) => api(over).content()
const ids = tooltipIds("r")

describe("scoping", () => {
  it("every part carries data-scope, data-part and data-instance", () => {
    const a = api()
    const parts = {
      trigger: a.trigger(state(), hoverProps),
      positioner: a.positioner(),
      content: a.content(),
      arrow: a.arrow(),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(props["data-scope"], part).toBe("tooltip")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("part ids come from the instance", () => {
    const a = api()
    expect(a.trigger(state(), hoverProps)["id"]).toBe(ids.trigger)
    expect(a.positioner()["id"]).toBe(ids.positioner)
    expect(a.content()["id"]).toBe(ids.content)
    expect(a.arrow()["id"]).toBe(ids.arrow)
  })
})

describe("Trigger data attributes", () => {
  it("data-state follows open", () => {
    expect(trigger({ open: true })["data-state"]).toBe("open")
    expect(trigger({ open: false })["data-state"]).toBe("closed")
  })

  it("data-hover is present only while hovered", () => {
    expect(trigger({}, { hovered: true })["data-hover"]).toBe("")
    expect(trigger({}, { hovered: false })["data-hover"]).toBeUndefined()
  })

  it("data-focus while focused, data-focus-visible only for keyboard and virtual focus", () => {
    const on = trigger({}, { focused: true, modality: "keyboard" })
    expect(on["data-focus"]).toBe("")
    expect(on["data-focus-visible"]).toBe("")
    const virtual = trigger({}, { focused: true, modality: "virtual" })
    expect(virtual["data-focus-visible"]).toBe("")
    for (const modality of ["pointer", "touch"] as const) {
      const p = trigger({}, { focused: true, modality })
      expect(p["data-focus"], modality).toBe("")
      expect(p["data-focus-visible"], modality).toBeUndefined()
    }
    const off = trigger({}, { focused: false, modality: "keyboard" })
    expect(off["data-focus"]).toBeUndefined()
    expect(off["data-focus-visible"]).toBeUndefined()
  })

  it("carries the hover-intent handlers and nothing that stops events", () => {
    const p = trigger() as Record<string, unknown>
    expect(p["onPointerMove"]).toBe(hoverProps.onPointerMove)
    expect(p["onPointerLeave"]).toBe(hoverProps.onPointerLeave)
    // The tooltip only listens on the trigger: no click, key or focus handler of its own,
    // so a menu or popover on the same trigger keeps its default behaviour (bits-ui#2200).
    for (const k of ["onClick", "onKeyDown", "onFocus", "onBlur", "onPointerDown", "onMouseDown"])
      expect(p[k], k).toBeUndefined()
  })

  it("adds no tabindex and no role to make the trigger focusable", () => {
    const p = trigger()
    expect(p).not.toHaveProperty("tabIndex")
    expect(p).not.toHaveProperty("tabindex")
    expect(p["role"]).toBeUndefined()
  })
})

describe("Positioner data attributes", () => {
  it("data-state, data-side and data-align from the placement", () => {
    const p = api().positioner()
    expect(p["data-state"]).toBe("open")
    expect(p["data-side"]).toBe("bottom")
    expect(p["data-align"]).toBe("start")
    expect(api({ open: false }).positioner()["data-state"]).toBe("closed")
  })

  it("data-instant is present only when the transition is instant", () => {
    expect(api({ instant: true }).positioner()["data-instant"]).toBe("")
    expect(api({ instant: false }).positioner()["data-instant"]).toBeUndefined()
  })

  it("data-placing until the first placement, then gone", () => {
    const unplaced: PlacementState = { ...placed, placed: false }
    expect(api({ placement: unplaced }).positioner()["data-placing"]).toBe("")
    expect(api().positioner()["data-placing"]).toBeUndefined()
  })

  it("data-anchor-hidden only when placed and the anchor is hidden", () => {
    expect(
      api({ placement: { ...placed, anchorHidden: true } }).positioner()["data-anchor-hidden"],
    ).toBe("")
    expect(api().positioner()["data-anchor-hidden"]).toBeUndefined()
    expect(
      api({ placement: { ...placed, placed: false, anchorHidden: true } }).positioner()[
        "data-anchor-hidden"
      ],
    ).toBeUndefined()
  })

  it("dir passes through for inline sides", () => {
    expect(api({ dir: "rtl" }).positioner()["dir"]).toBe("rtl")
  })
})

describe("Content data attributes", () => {
  it("data-state, data-side, data-align, data-placing", () => {
    const c = content()
    expect(c["data-state"]).toBe("open")
    expect(c["data-side"]).toBe("bottom")
    expect(c["data-align"]).toBe("start")
    expect(c["data-placing"]).toBeUndefined()
    expect(content({ open: false })["data-state"]).toBe("closed")
    expect(content({ placement: { ...placed, placed: false } })["data-placing"]).toBe("")
  })

  it("data-instant mirrors the instant transition", () => {
    expect(content({ instant: true })["data-instant"]).toBe("")
    expect(content({ instant: false })["data-instant"]).toBeUndefined()
  })

  it("data-type is description or label", () => {
    expect(content({ type: "description" })["data-type"]).toBe("description")
    expect(content({ type: "label" })["data-type"]).toBe("label")
  })

  it("data-anchor-hidden mirrors the placement", () => {
    expect(content({ placement: { ...placed, anchorHidden: true } })["data-anchor-hidden"]).toBe("")
  })

  it("never focusable: no tabindex", () => {
    const c = content()
    expect(c).not.toHaveProperty("tabIndex")
    expect(c).not.toHaveProperty("tabindex")
  })
})

describe("Arrow data attributes", () => {
  it("data-side from the placement, hidden from assistive technology", () => {
    const a = api().arrow()
    expect(a["data-side"]).toBe("bottom")
    expect(a["aria-hidden"]).toBe("true")
  })
  // data-uncentered is toggled on the element by the position tracker, not by connect.
})

describe("Description And Label Wiring", () => {
  it("description: role tooltip and aria-describedby = the content id once mounted, open or closed", () => {
    for (const open of [true, false]) {
      expect(content({ open })["role"]).toBe("tooltip")
      const t = trigger({ open })
      expect(t["aria-describedby"]).toBe(ids.content)
      expect(t["aria-labelledby"]).toBeUndefined()
    }
  })

  it("references exist only once the content is mounted (no dangling IDREF)", () => {
    expect(trigger({ contentMounted: false })["aria-describedby"]).toBeUndefined()
    expect(trigger({ contentMounted: false, type: "label" })["aria-labelledby"]).toBeUndefined()
    expect(trigger({ contentMounted: false }, { describedBy: "hint" })["aria-describedby"]).toBe(
      "hint",
    )
  })

  it("the consumer's ids stay first, the content id is appended", () => {
    expect(trigger({}, { describedBy: "hint" })["aria-describedby"]).toBe(`hint ${ids.content}`)
    expect(trigger({}, { describedBy: "a b" })["aria-describedby"]).toBe(`a b ${ids.content}`)
  })

  it("the consumer's ids are kept even when the tooltip adds none", () => {
    expect(trigger({ type: "label" }, { describedBy: "hint" })["aria-describedby"]).toBe("hint")
    expect(trigger({}, { labelledBy: "lbl" })["aria-labelledby"]).toBe("lbl")
  })

  it("label: no role, aria-labelledby = the content id, no aria-describedby from the tooltip", () => {
    expect(content({ type: "label" })["role"]).toBeUndefined()
    for (const open of [true, false]) {
      const t = trigger({ type: "label", open })
      expect(t["aria-labelledby"]).toBe(ids.content)
      expect(t["aria-describedby"]).toBeUndefined()
    }
  })

  it("label: the consumer's aria-labelledby comes first", () => {
    expect(trigger({ type: "label" }, { labelledBy: "lbl" })["aria-labelledby"]).toBe(
      `lbl ${ids.content}`,
    )
  })

  it("an empty consumer id does not leave a stray space", () => {
    expect(trigger({}, { describedBy: "" })["aria-describedby"]).toBe(ids.content)
  })

  it("the references are critical (a consumer prop cannot overwrite them)", () => {
    const t = trigger()
    expect(t[CRITICAL]).toEqual(expect.arrayContaining(["aria-describedby", "aria-labelledby"]))
  })

  it("the content has no aria-hidden or inert of its own", () => {
    const c = content({ open: false }) as Record<string, unknown>
    expect(c["aria-hidden"]).toBeUndefined()
    expect(c["inert"]).toBeUndefined()
  })
})

describe("events", () => {
  it("focus and blur and press are forwarded as machine events", () => {
    const send = vi.fn()
    const a = api({}, send)
    a.focus("keyboard", "key")
    a.blur()
    a.pressStart(false)
    a.pressStart(true)
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      { type: "FOCUS", modality: "keyboard", cause: "key" },
      { type: "BLUR" },
      { type: "PRESS.START" },
      { type: "PRESS.START", pointer: true },
    ])
  })

  it("open mirrors the input", () => {
    expect(api({ open: true }).open).toBe(true)
    expect(api({ open: false }).open).toBe(false)
  })
})
