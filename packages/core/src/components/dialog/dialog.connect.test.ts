// The Dialog's attributes (openspec add-dialog 2.5): every one in "Roles And ARIA
// Attributes" and "Data Attributes".
import { describe, expect, it, vi } from "vitest"
import { CRITICAL } from "../../connect/props"
import { type DialogConnectInput, dialogConnect } from "./dialog.connect"
import { dialogMessages } from "./dialog.messages"

const base: DialogConnectInput = {
  scope: "dialog",
  instance: "r",
  open: true,
  modal: true,
  opener: "t1",
  closeReason: null,
  rendered: { title: "dialog-r-title", description: "dialog-r-description" },
  contentMounted: true,
  titleFocusTarget: false,
  messages: dialogMessages,
}
const api = (over: Partial<DialogConnectInput> = {}, send = vi.fn()) =>
  dialogConnect({ ...base, ...over }, send)
const btn = (id: string, over = {}) => ({
  id,
  focused: false,
  modality: "keyboard" as const,
  pressed: false,
  ...over,
})
const content = (over: Partial<DialogConnectInput> = {}, own = {}) => api(over).content(own)

describe("scoping", () => {
  it("every part carries data-scope, data-part and data-instance", () => {
    const a = api()
    const parts = {
      trigger: a.trigger(btn("t1")),
      backdrop: a.backdrop(),
      positioner: a.positioner(),
      content: a.content({}),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      "close-trigger": a.closeTrigger({ ...btn("c1"), empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(props["data-scope"], part).toBe("dialog")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("title and description carry only the scoping attributes (and the heading ones)", () => {
    const a = api()
    const keys = (p: object) => Object.keys(p).filter((k) => k.startsWith("data-"))
    expect(keys(a.title({ level: 2, tag: "h2" })).sort()).toEqual(
      ["data-instance", "data-level", "data-part", "data-scope"].sort(),
    )
    expect(keys(a.description()).sort()).toEqual(["data-instance", "data-part", "data-scope"])
  })
})

describe("trigger", () => {
  it("is a button with aria-haspopup=dialog", () => {
    const p = api().trigger(btn("t1"))
    expect(p["type"]).toBe("button")
    expect(p["aria-haspopup"]).toBe("dialog")
  })

  it("aria-expanded and data-state are true / open only on the trigger that opened it", () => {
    const a = api()
    expect(a.trigger(btn("t1"))["aria-expanded"]).toBe("true")
    expect(a.trigger(btn("t1"))["data-state"]).toBe("open")
    expect(a.trigger(btn("t2"))["aria-expanded"]).toBe("false")
    expect(a.trigger(btn("t2"))["data-state"]).toBe("closed")
    const programmatic = api({ opener: null })
    expect(programmatic.trigger(btn("t1"))["aria-expanded"]).toBe("false")
    const closed = api({ open: false })
    expect(closed.trigger(btn("t1"))["aria-expanded"]).toBe("false")
  })

  it("aria-expanded is a critical attribute", () => {
    expect(api().trigger(btn("t1"))[CRITICAL]).toContain("aria-expanded")
  })

  it("aria-controls points at the content only while it is mounted", () => {
    expect(api().trigger(btn("t1"))["aria-controls"]).toBe("dialog-r-content")
    expect(api({ contentMounted: false }).trigger(btn("t1"))["aria-controls"]).toBeUndefined()
  })

  it("focus, press and disabled data attributes", () => {
    const a = api()
    const idle = a.trigger(btn("t1"))
    expect(idle["data-focus"]).toBeUndefined()
    expect(idle["data-pressed"]).toBeUndefined()
    expect(idle["data-disabled"]).toBeUndefined()
    const on = a.trigger(btn("t1", { focused: true, pressed: true, disabled: true }))
    expect(on["data-focus"]).toBe("")
    expect(on["data-focus-visible"]).toBe("")
    expect(on["data-pressed"]).toBe("")
    expect(on["data-disabled"]).toBe("")
    expect(
      a.trigger(btn("t1", { focused: true, modality: "pointer" }))["data-focus-visible"],
    ).toBeUndefined()
  })

  it("data-close-reason is kebab case after close, on triggers too, absent while open", () => {
    const closed = api({ open: false, closeReason: "escape-key" })
    expect(closed.trigger(btn("t1"))["data-close-reason"]).toBe("escape-key")
    expect(
      api({ open: false, closeReason: "close-trigger" }).trigger(btn("t1"))["data-close-reason"],
    ).toBe("close-trigger")
    expect(
      api({ closeReason: "escape-key" }).trigger(btn("t1"))["data-close-reason"],
    ).toBeUndefined()
    expect(api({ open: false }).trigger(btn("t1"))["data-close-reason"]).toBeUndefined()
  })

  it("pressTrigger / pressClose send the events", () => {
    const send = vi.fn()
    const a = api({}, send)
    a.pressTrigger("t1", "touch")
    a.pressClose("keyboard")
    expect(send).toHaveBeenNthCalledWith(1, {
      type: "TRIGGER_PRESS",
      trigger: "t1",
      modality: "touch",
    })
    expect(send).toHaveBeenNthCalledWith(2, { type: "CLOSE_TRIGGER_PRESS", modality: "keyboard" })
  })
})

describe("content", () => {
  it("role dialog, tabindex -1, aria-modal only when modal", () => {
    const p = content()
    expect(p["role"]).toBe("dialog")
    expect(p["tabindex"]).toBe(-1)
    expect(p["aria-modal"]).toBe("true")
    expect(content({ modal: false })["aria-modal"]).toBeUndefined()
  })

  it("aria-labelledby / -describedby list the rendered parts only", () => {
    const p = content()
    expect(p["aria-labelledby"]).toBe("dialog-r-title")
    expect(p["aria-describedby"]).toBe("dialog-r-description")
    const none = content({ rendered: {} })
    expect(none["aria-labelledby"]).toBeUndefined()
    // radix#3007: no description, no aria-describedby
    expect(none["aria-describedby"]).toBeUndefined()
    expect(content({ rendered: { title: "dialog-r-title" } })["aria-describedby"]).toBeUndefined()
  })

  it("keeps the consumer's ids first and appends the parts' ids", () => {
    const p = content({}, { labelledBy: "mine", describedBy: "hint" })
    expect(p["aria-labelledby"]).toBe("mine dialog-r-title")
    expect(p["aria-describedby"]).toBe("hint dialog-r-description")
    const only = content({ rendered: {} }, { labelledBy: "mine", describedBy: "hint" })
    expect(only["aria-labelledby"]).toBe("mine")
    expect(only["aria-describedby"]).toBe("hint")
  })

  it("data-state, data-modal and data-focus-within", () => {
    expect(content()["data-state"]).toBe("open")
    expect(content({ open: false })["data-state"]).toBe("closed")
    expect(content()["data-modal"]).toBe("")
    expect(content({ modal: false })["data-modal"]).toBeUndefined()
    expect(content()["data-focus-within"]).toBeUndefined()
    expect(content({ focusWithin: true })["data-focus-within"]).toBe("")
  })

  it("data-focus / data-focus-visible only when the content itself is focused", () => {
    expect(content()["data-focus"]).toBeUndefined()
    const touch = content({ contentFocused: true, modality: "touch" })
    expect(touch["data-focus"]).toBe("")
    expect(touch["data-focus-visible"]).toBeUndefined()
    const key = content({ contentFocused: true, modality: "keyboard" })
    expect(key["data-focus-visible"]).toBe("")
  })

  it("data-close-reason from close until the next open, kebab case", () => {
    expect(content({ open: false, closeReason: "outside-press" })["data-close-reason"]).toBe(
      "outside-press",
    )
    expect(content({ open: false, closeReason: "parent-dismissed" })["data-close-reason"]).toBe(
      "parent-dismissed",
    )
    expect(content({ open: true, closeReason: "escape-key" })["data-close-reason"]).toBeUndefined()
  })

  it("non-modal: pointer-events auto on the content, none on the positioner", () => {
    expect((content({ modal: false })["style"] as Record<string, string>)["pointerEvents"]).toBe(
      "auto",
    )
    const pos = api({ modal: false }).positioner()
    expect((pos["style"] as Record<string, string>)["pointerEvents"]).toBe("none")
    expect(pos["data-modal"]).toBeUndefined()
    expect(api().positioner()["style"]).toBeUndefined()
    expect(content()["style"]).toBeUndefined()
  })
})

describe("backdrop and positioner", () => {
  it("backdrop is aria-hidden and follows data-state", () => {
    expect(api().backdrop()["aria-hidden"]).toBe("true")
    expect(api().backdrop()["data-state"]).toBe("open")
    expect(api({ open: false }).backdrop()["data-state"]).toBe("closed")
  })

  it("positioner has data-state and data-modal when modal", () => {
    expect(api().positioner()["data-state"]).toBe("open")
    expect(api().positioner()["data-modal"]).toBe("")
  })

  it("a mousedown on the surface itself does not move focus; on a descendant it does", () => {
    for (const part of [api().backdrop(), api().positioner()]) {
      const onMouseDown = part["onMouseDown"] as (e: unknown) => void
      const own = { target: 1, currentTarget: 1, preventDefault: vi.fn() }
      onMouseDown(own)
      expect(own.preventDefault).toHaveBeenCalled()
      const inner = { target: 2, currentTarget: 1, preventDefault: vi.fn() }
      onMouseDown(inner)
      expect(inner.preventDefault).not.toHaveBeenCalled()
    }
  })
})

describe("layer metadata and CSS variables", () => {
  const meta = { index: 3, depth: 1, nested: true, hasNested: true, nestedCount: 2 }

  it("data-nested, data-has-nested and the CSS variables on backdrop, positioner and content", () => {
    const a = api({ meta })
    for (const p of [a.backdrop(), a.positioner(), a.content({})]) {
      expect(p["data-nested"]).toBe("")
      expect(p["data-has-nested"]).toBe("")
      expect((p["style"] as Record<string, string>)["--layer-index"]).toBe("3")
      expect((p["style"] as Record<string, string>)["--nested-layer-count"]).toBe("2")
    }
  })

  it("flags are absent for a root dialog with no children; absent without metadata", () => {
    const root = api({
      meta: { index: 0, depth: 0, nested: false, hasNested: false, nestedCount: 0 },
    })
    expect(root.content({})["data-nested"]).toBeUndefined()
    expect(root.content({})["data-has-nested"]).toBeUndefined()
    expect((root.content({})["style"] as Record<string, string>)["--nested-layer-count"]).toBe("0")
    expect(api().content({})["data-nested"]).toBeUndefined()
  })

  it("non-modal keeps the CSS variables next to pointer-events", () => {
    const style = api({ meta, modal: false }).positioner()["style"] as Record<string, string>
    expect(style["--layer-index"]).toBe("3")
    expect(style["pointerEvents"]).toBe("none")
  })
})

describe("title", () => {
  it("renders the id the content references, plus the heading attributes", () => {
    const p = api().title({ level: 2, tag: "h2" })
    expect(p["id"]).toBe("dialog-r-title")
    expect(p["data-level"]).toBe("2")
    expect(p["role"]).toBeUndefined()
    expect(p["aria-level"]).toBeUndefined()
  })

  it("headingProps on a substituted title: role heading and aria-level", () => {
    const p = api().title({ level: 2, tag: "div" })
    expect(p["role"]).toBe("heading")
    expect(p["aria-level"]).toBe("2")
    expect(api().title({ level: 3, tag: "h3" })["data-level"]).toBe("3")
  })

  it("tabindex -1 only while open and it is the initial focus target", () => {
    expect(api({ titleFocusTarget: true }).title({ level: 2, tag: "h2" })["tabindex"]).toBe(-1)
    expect(api().title({ level: 2, tag: "h2" })["tabindex"]).toBeUndefined()
    expect(
      api({ titleFocusTarget: true, open: false }).title({ level: 2, tag: "h2" })["tabindex"],
    ).toBeUndefined()
  })
})

describe("close trigger", () => {
  const close = (over = {}, input: Partial<DialogConnectInput> = {}) =>
    api(input).closeTrigger({ ...btn("c1"), empty: false, ...over })

  it("is a button", () => {
    expect(close()["type"]).toBe("button")
  })

  it("aria-label from messages.close only when it renders no content", () => {
    expect(close({ empty: true })["aria-label"]).toBe("Close")
    expect(close({ empty: false })["aria-label"]).toBeUndefined()
    expect(close({ empty: true }, { messages: { close: "Chiudi" } })["aria-label"]).toBe("Chiudi")
  })

  it("focus and press data attributes", () => {
    const p = close({ focused: true, pressed: true })
    expect(p["data-focus"]).toBe("")
    expect(p["data-focus-visible"]).toBe("")
    expect(p["data-pressed"]).toBe("")
    expect(close()["data-pressed"]).toBeUndefined()
  })
})

describe("alert dialog scope", () => {
  it("uses the alertdialog role for the alert-dialog scope", () => {
    const p = dialogConnect({ ...base, scope: "alert-dialog" }, vi.fn()).content({})
    expect(p["role"]).toBe("alertdialog")
    expect(p["data-scope"]).toBe("alert-dialog")
  })
})
