// The Popover's attributes (openspec add-popover): "Data Attributes", "ARIA Attributes",
// "Accessible Name And Description", the scope option and the messages.
import { describe, expect, it, vi } from "vitest"
import { CRITICAL } from "../../connect/props"
import { unplaced } from "../../dom/position/connect"
import { type PopoverConnectInput, popoverConnect } from "./popover.connect"
import { popoverMessages } from "./popover.messages"

const placed = { placed: true, side: "bottom", align: "center", anchorHidden: false } as const
const base: PopoverConnectInput = {
  instance: "r",
  open: true,
  modal: false,
  placement: placed,
  closeReason: null,
  rendered: { title: "popover-r-title", description: "popover-r-description" },
  contentMounted: true,
  messages: popoverMessages,
}
const api = (over: Partial<PopoverConnectInput> = {}, send = vi.fn()) =>
  popoverConnect({ ...base, ...over }, send)
const btn = (over = {}) => ({
  focused: false,
  modality: "keyboard" as const,
  pressed: false,
  tag: "button",
  ...over,
})
const content = (over: Partial<PopoverConnectInput> = {}, own = {}) => api(over).content(own)
const keys = (p: object) => Object.keys(p).filter((k) => k.startsWith("data-"))

describe("scoping", () => {
  it("every part carries data-scope, data-part and data-instance", () => {
    const a = api()
    const parts = {
      trigger: a.trigger(btn()),
      anchor: a.anchor(),
      indicator: a.indicator(),
      positioner: a.positioner(),
      content: a.content({}),
      arrow: a.arrow(),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      "close-trigger": a.closeTrigger({ ...btn(), empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(props["data-scope"], part).toBe("popover")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("Composite re-scopes the data attributes", () => {
    const a = api({ scope: "date-picker" })
    for (const [part, props] of Object.entries({
      trigger: a.trigger(btn()),
      anchor: a.anchor(),
      indicator: a.indicator(),
      positioner: a.positioner(),
      content: a.content({}),
      arrow: a.arrow(),
    })) {
      expect(props["data-scope"], part).toBe("date-picker")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("part ids derive from the scope and instance", () => {
    expect(api().trigger(btn())["id"]).toBe("popover-r-trigger")
    expect(api({ scope: "date-picker" }).content({})["id"]).toBe("date-picker-r-content")
  })

  it("title and description carry only the scoping attributes (and the heading ones)", () => {
    const a = api()
    expect(keys(a.title({ level: 2, tag: "h2" })).sort()).toEqual(
      ["data-instance", "data-level", "data-part", "data-scope"].sort(),
    )
    expect(keys(a.description()).sort()).toEqual(["data-instance", "data-part", "data-scope"])
  })
})

describe("trigger", () => {
  it("ARIA: haspopup dialog, aria-expanded follows open, a critical attribute", () => {
    const p = api().trigger(btn())
    expect(p["aria-haspopup"]).toBe("dialog")
    expect(p["aria-expanded"]).toBe("true")
    expect(p[CRITICAL]).toContain("aria-expanded")
    expect(api({ open: false }).trigger(btn())["aria-expanded"]).toBe("false")
  })

  it("aria-controls points at the content only while it is mounted (reka-ui#2597)", () => {
    expect(api().trigger(btn())["aria-controls"]).toBe("popover-r-content")
    expect(api({ contentMounted: false }).trigger(btn())["aria-controls"]).toBeUndefined()
    const closed = api({ open: false, contentMounted: false }).trigger(btn())
    expect(closed["aria-expanded"]).toBe("false")
    expect(closed["aria-controls"]).toBeUndefined()
  })

  it("data-state, data-pressed, data-focus and data-focus-visible", () => {
    expect(api().trigger(btn())["data-state"]).toBe("open")
    expect(api({ open: false }).trigger(btn())["data-state"]).toBe("closed")
    const idle = api().trigger(btn())
    expect(idle["data-pressed"]).toBeUndefined()
    expect(idle["data-focus"]).toBeUndefined()
    expect(idle["data-focus-visible"]).toBeUndefined()
    expect(api().trigger(btn({ pressed: true }))["data-pressed"]).toBe("")
    const kb = api().trigger(btn({ focused: true, modality: "keyboard" }))
    expect(kb["data-focus"]).toBe("")
    expect(kb["data-focus-visible"]).toBe("")
    const mouse = api().trigger(btn({ focused: true, modality: "pointer" }))
    expect(mouse["data-focus"]).toBe("")
    expect(mouse["data-focus-visible"]).toBeUndefined()
  })

  it("data-disabled only when disabled", () => {
    expect(api().trigger(btn())["data-disabled"]).toBeUndefined()
    expect(api({ disabled: true }).trigger(btn())["data-disabled"]).toBe("")
  })

  it("is a button by default; rendered as a div it gets role=button and tabindex=0", () => {
    const native = api().trigger(btn())
    expect(native["type"]).toBe("button")
    expect(native["role"]).toBeUndefined()
    const div = api().trigger(btn({ tag: "div" }))
    expect(div["role"]).toBe("button")
    expect(div["tabindex"]).toBe(0)
  })

  it("carries the anchor name unless an Anchor is rendered", () => {
    const own = api().trigger(btn())
    const anchored = api({ anchorRendered: true }).trigger(btn())
    expect(JSON.stringify(own)).not.toBe(JSON.stringify(anchored))
    expect(api({ anchorRendered: true }).anchor()["id"]).toBe("popover-r-anchor")
  })

  it("pressTrigger sends a trigger event with the modality", () => {
    const send = vi.fn()
    api({}, send).pressTrigger("keyboard")
    expect(send).toHaveBeenCalledWith({ type: "trigger", modality: "keyboard" })
    api({}, send).pressClose("touch")
    expect(send).toHaveBeenCalledWith({ type: "close-trigger", modality: "touch" })
    api({}, send).reposition()
    expect(send).toHaveBeenCalledWith({ type: "POSITION.REPOSITION" })
  })
})

describe("indicator and arrow", () => {
  it("indicator is aria-hidden and carries data-state", () => {
    const p = api().indicator()
    expect(p["aria-hidden"]).toBe("true")
    expect(p["data-state"]).toBe("open")
    expect(api({ open: false }).indicator()["data-state"]).toBe("closed")
  })

  // data-uncentered is toggled on the element by the position tracker, not by connect.
  it("arrow is aria-hidden with data-side, and style-positioned", () => {
    const p = api().arrow()
    expect(p["aria-hidden"]).toBe("true")
    expect(p["data-side"]).toBe("bottom")
    expect(p["id"]).toBe("popover-r-arrow")
  })
})

describe("positioner", () => {
  it("placed: data-state, data-side, data-align, no data-placing, no data-anchor-hidden", () => {
    const p = api().positioner()
    expect(p["data-state"]).toBe("open")
    expect(p["data-side"]).toBe("bottom")
    expect(p["data-align"]).toBe("center")
    expect(p["data-placing"]).toBeUndefined()
    expect(p["data-anchor-hidden"]).toBeUndefined()
  })

  it("unplaced: data-placing; anchor hidden: data-anchor-hidden", () => {
    expect(api({ placement: unplaced("top", "start") }).positioner()["data-placing"]).toBe("")
    expect(
      api({ placement: { ...placed, anchorHidden: true } }).positioner()["data-anchor-hidden"],
    ).toBe("")
  })

  it("closed: data-state closed", () => {
    expect(api({ open: false }).positioner()["data-state"]).toBe("closed")
  })
})

describe("content", () => {
  it("role dialog, tabindex -1, id; not modal by default", () => {
    const p = content()
    expect(p["role"]).toBe("dialog")
    expect(p["tabindex"]).toBe(-1)
    expect(p["id"]).toBe("popover-r-content")
    expect(p["aria-modal"]).toBeUndefined()
    expect(p["data-modal"]).toBeUndefined()
  })

  it("modal: aria-modal true and data-modal", () => {
    const p = content({ modal: true })
    expect(p["aria-modal"]).toBe("true")
    expect(p["data-modal"]).toBe("")
  })

  it("styling hooks while open and placed below: state open, side bottom, no placing/modal", () => {
    const p = content()
    expect(p["data-state"]).toBe("open")
    expect(p["data-side"]).toBe("bottom")
    expect(p["data-align"]).toBe("center")
    expect(p["data-placing"]).toBeUndefined()
    expect(p["data-modal"]).toBeUndefined()
    expect(p["data-anchor-hidden"]).toBeUndefined()
  })

  it("unplaced: data-placing, and no entry animation until placed", () => {
    const p = content({ placement: unplaced("bottom", "center"), meta: meta() })
    expect(p["data-placing"]).toBe("")
    expect((p["style"] as Record<string, string>)["animation-name"]).toBe("none")
    expect(
      (content({ meta: meta() })["style"] as Record<string, string>)["animation-name"],
    ).toBeUndefined()
  })

  it("data-close-reason only while closed (exiting), until the next open", () => {
    expect(content({ open: true, closeReason: "escape-key" })["data-close-reason"]).toBeUndefined()
    expect(content({ open: false, closeReason: "escape-key" })["data-close-reason"]).toBe(
      "escape-key",
    )
    expect(content({ open: false, closeReason: null })["data-close-reason"]).toBeUndefined()
    expect(content({ open: false, closeReason: "close-trigger" })["data-state"]).toBe("closed")
  })

  it("layer metadata: data-nested, data-has-nested and the CSS variables", () => {
    const p = content({ meta: meta({ nested: true, hasNested: true, index: 2, nestedCount: 1 }) })
    expect(p["data-nested"]).toBe("")
    expect(p["data-has-nested"]).toBe("")
    const style = p["style"] as Record<string, string>
    expect(style["--layer-index"]).toBe("2")
    expect(style["--nested-layer-count"]).toBe("1")
    const plain = content({ meta: meta() })
    expect(plain["data-nested"]).toBeUndefined()
    expect(plain["data-has-nested"]).toBeUndefined()
  })

  it("without layer metadata (closed or server) there are no nesting attributes", () => {
    const p = content()
    expect(keys(p)).not.toContain("data-nested")
    expect(p["style"]).toBeUndefined()
  })

  it("focus attributes: data-focus-within and the content's own focus", () => {
    expect(content()["data-focus-within"]).toBeUndefined()
    expect(content({ focusWithin: true })["data-focus-within"]).toBe("")
    const focused = content({ contentFocused: true, modality: "keyboard" })
    expect(focused["data-focus"]).toBe("")
    expect(focused["data-focus-visible"]).toBe("")
    const pointer = content({ contentFocused: true, modality: "pointer" })
    expect(pointer["data-focus"]).toBe("")
    expect(pointer["data-focus-visible"]).toBeUndefined()
  })
})

describe("accessible name and description", () => {
  it("the rendered Title names the dialog", () => {
    expect(content()["aria-labelledby"]).toBe("popover-r-title")
  })

  it("Title wins over the consumer's aria-labelledby", () => {
    expect(content({}, { labelledBy: "mine" })["aria-labelledby"]).toBe("popover-r-title")
  })

  it("no Title: the consumer's aria-labelledby, then its aria-label", () => {
    const noTitle = { rendered: {} }
    expect(content(noTitle, { labelledBy: "mine" })["aria-labelledby"]).toBe("mine")
    const labelled = content(noTitle, { label: "Filters" })
    expect(labelled["aria-label"]).toBe("Filters")
    expect(labelled["aria-labelledby"]).toBeUndefined()
  })

  it("a consumer aria-labelledby beats an aria-label (precedence Title, consumer id, label)", () => {
    const p = content({ rendered: {} }, { labelledBy: "mine", label: "L" })
    expect(p["aria-labelledby"]).toBe("mine")
  })

  it("non-modal with no title and no consumer name falls back to the trigger", () => {
    expect(content({ rendered: {} })["aria-labelledby"]).toBe("popover-r-trigger")
  })

  it("modal gets no trigger fallback", () => {
    const p = content({ rendered: {}, modal: true })
    expect(p["aria-labelledby"]).toBeUndefined()
    expect(p["aria-label"]).toBeUndefined()
  })

  it("the fallback follows the scope", () => {
    expect(content({ rendered: {}, scope: "date-picker" })["aria-labelledby"]).toBe(
      "date-picker-r-trigger",
    )
  })

  it("the Description is referenced only while rendered, merged after consumer ids", () => {
    expect(content()["aria-describedby"]).toBe("popover-r-description")
    expect(content({ rendered: { title: "t" } })["aria-describedby"]).toBeUndefined()
    expect(content({}, { describedBy: "hint" })["aria-describedby"]).toBe(
      "hint popover-r-description",
    )
    expect(content({ rendered: {} }, { describedBy: "hint" })["aria-describedby"]).toBe("hint")
  })
})

describe("close trigger and messages", () => {
  it("an empty close trigger is named by messages.close", () => {
    const p = api().closeTrigger({ ...btn(), empty: true })
    expect(p["aria-label"]).toBe("Close")
    expect(p["type"]).toBe("button")
  })

  it("custom messages replace the default name (Chiudi)", () => {
    const p = api({ messages: { close: "Chiudi" } }).closeTrigger({ ...btn(), empty: true })
    expect(p["aria-label"]).toBe("Chiudi")
  })

  it("a close trigger with content of its own has no aria-label", () => {
    expect(api().closeTrigger({ ...btn(), empty: false })["aria-label"]).toBeUndefined()
  })

  it("data-pressed, data-focus and data-focus-visible", () => {
    const p = api().closeTrigger({ ...btn({ pressed: true, focused: true }), empty: false })
    expect(p["data-pressed"]).toBe("")
    expect(p["data-focus"]).toBe("")
    expect(p["data-focus-visible"]).toBe("")
  })
})

describe("title", () => {
  it("a native heading carries its level; a substituted element gets role and aria-level", () => {
    const h = api().title({ level: 3, tag: "h3" })
    expect(h["data-level"]).toBe("3")
    expect(h["role"]).toBeUndefined()
    const div = api().title({ level: 2, tag: "div" })
    expect(div["role"]).toBe("heading")
    expect(div["aria-level"]).toBe("2")
    expect(div["id"]).toBe("popover-r-title")
  })
})

function meta(
  over: Partial<{ nested: boolean; hasNested: boolean; index: number; nestedCount: number }> = {},
) {
  return { nested: false, hasNested: false, index: 0, nestedCount: 0, ...over } as never
}
