// A Dialog with `role="alertdialog"` (openspec merge-alert-dialog-into-dialog, formerly
// add-alert-dialog 2.1, 2.2): the scope, the role, the always-on modality, Cancel and Action,
// and the close-reason attribute.
import { describe, expect, it, vi } from "vitest"
import { type DialogConnectInput, dialogConnect } from "./dialog.connect"
import { dialogMessages } from "./dialog.messages"

type AlertDialogConnectInput = Omit<DialogConnectInput, "scope" | "modal" | "role">

const base: AlertDialogConnectInput = {
  instance: "r",
  open: true,
  opener: "t1",
  closeReason: null,
  rendered: { title: "dialog-r-title", description: "dialog-r-description" },
  contentMounted: true,
  titleFocusTarget: false,
  messages: dialogMessages,
}
const api = (over: Partial<AlertDialogConnectInput> = {}, send = vi.fn()) =>
  dialogConnect({ ...base, ...over, scope: "dialog", role: "alertdialog", modal: false }, send)
const btn = (id: string, over = {}) => ({
  id,
  focused: false,
  modality: "keyboard" as const,
  pressed: false,
  ...over,
})

describe("scoping", () => {
  it("every part carries data-scope dialog, its data-part and data-instance", () => {
    const a = api()
    const parts = {
      trigger: a.trigger(btn("t1")),
      backdrop: a.backdrop(),
      positioner: a.positioner(),
      content: a.content({}),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      cancel: a.cancel(btn("c1")),
      action: a.action(btn("a1")),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(props["data-scope"], part).toBe("dialog")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("ids derive from the dialog scope", () => {
    const a = api()
    expect(a.content({})["id"]).toBe("dialog-r-content")
    expect(a.title({ level: 2, tag: "h2" })["id"]).toBe("dialog-r-title")
    expect(a.trigger(btn("t1"))["aria-controls"]).toBe("dialog-r-content")
  })
})

describe("content: always modal", () => {
  it("role alertdialog, aria-modal and data-modal, even if the input says non-modal", () => {
    // The input type omits modal; a stray value from an untyped caller must not win.
    const p = api({ modal: false } as never).content({})
    expect(p["role"]).toBe("alertdialog")
    expect(p["aria-modal"]).toBe("true")
    expect(p["data-modal"]).toBe("")
    expect(p["tabindex"]).toBe(-1)
    expect(p["style"]).toBeUndefined()
  })

  it("the positioner is modal too: data-modal, no pointer-events override", () => {
    const p = api().positioner()
    expect(p["data-modal"]).toBe("")
    expect(p["style"]).toBeUndefined()
  })

  it("aria-labelledby / -describedby list the rendered parts only (no description: none)", () => {
    expect(api().content({})["aria-labelledby"]).toBe("dialog-r-title")
    expect(api().content({})["aria-describedby"]).toBe("dialog-r-description")
    const noDesc = api({ rendered: { title: "dialog-r-title" } }).content({})
    expect(noDesc["aria-describedby"]).toBeUndefined()
    expect(
      api({ rendered: {} }).content({ labelledBy: "mine", describedBy: "hint" })[
        "aria-describedby"
      ],
    ).toBe("hint")
  })

  it("data-state, data-focus-within and layer metadata come from the dialog", () => {
    expect(api().content({})["data-state"]).toBe("open")
    expect(api({ open: false }).content({})["data-state"]).toBe("closed")
    expect(api({ focusWithin: true }).content({})["data-focus-within"]).toBe("")
    const meta = { index: 2, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const p = api({ meta }).content({})
    expect(p["data-nested"]).toBe("")
    expect(p["data-has-nested"]).toBe("")
  })

  it("the title is an h2 by default and a substituted one gets role heading", () => {
    expect(api().title({ level: 2, tag: "h2" })["data-level"]).toBe("2")
    const p = api().title({ level: 2, tag: "div" })
    expect(p["role"]).toBe("heading")
    expect(p["aria-level"]).toBe("2")
  })
})

describe("cancel and action", () => {
  it.each(["cancel", "action"] as const)("%s is a type=button button with its id", (part) => {
    const p = api()[part](btn("x1"))
    expect(p["type"]).toBe("button")
    expect(p["id"]).toBe("x1")
  })

  it.each(["cancel", "action"] as const)("%s: focus, press and disabled attributes", (part) => {
    const a = api()
    const idle = a[part](btn("x1"))
    expect(idle["data-focus"]).toBeUndefined()
    expect(idle["data-focus-visible"]).toBeUndefined()
    expect(idle["data-pressed"]).toBeUndefined()
    expect(idle["data-disabled"]).toBeUndefined()
    const on = a[part](btn("x1", { focused: true, pressed: true, disabled: true }))
    expect(on["data-focus"]).toBe("")
    expect(on["data-focus-visible"]).toBe("")
    expect(on["data-pressed"]).toBe("")
    expect(on["data-disabled"]).toBe("")
    const pointer = a[part](btn("x1", { focused: true, modality: "pointer" }))
    expect(pointer["data-focus"]).toBe("")
    expect(pointer["data-focus-visible"]).toBeUndefined()
  })

  it("pressCancel / pressAction send CANCEL_PRESS / ACTION_PRESS", () => {
    const send = vi.fn()
    const a = api({}, send)
    a.pressCancel("touch")
    a.pressAction("a1", "keyboard")
    expect(send).toHaveBeenNthCalledWith(1, { type: "CANCEL_PRESS", modality: "touch" })
    expect(send).toHaveBeenNthCalledWith(2, {
      type: "ACTION_PRESS",
      action: "a1",
      modality: "keyboard",
    })
  })

  it("pressTrigger sends TRIGGER_PRESS", () => {
    const send = vi.fn()
    api({}, send).pressTrigger("t1", "pointer")
    expect(send).toHaveBeenCalledWith({ type: "TRIGGER_PRESS", trigger: "t1", modality: "pointer" })
  })
})

describe("close reason attribute", () => {
  it.each([
    ["cancel", "cancel"],
    ["action", "action"],
    ["escape-key", "escape-key"],
  ] as const)("%s is %s on content, positioner-less parts and trigger after close", (r, k) => {
    const closed = api({ open: false, closeReason: r })
    expect(closed.content({})["data-close-reason"]).toBe(k)
    expect(closed.trigger(btn("t1"))["data-close-reason"]).toBe(k)
  })

  it("is absent while open and before any close", () => {
    expect(api({ closeReason: "action" }).content({})["data-close-reason"]).toBeUndefined()
    expect(api({ open: false }).content({})["data-close-reason"]).toBeUndefined()
  })
})
