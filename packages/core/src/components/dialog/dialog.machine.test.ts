// The Dialog machine in Node (openspec add-dialog 1.4): every transition, controlled refusal,
// cancel(), open + close in one task (zag#3324), parent-driven changes, the close reason,
// the opener, the part registry and the guards. The overlay effect is replaced by a recorder
// that captures its options, so the dismiss wiring is checked without a DOM.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type DismissRequest, dismissRequest } from "../../dom/dismiss"
import type { OverlayEffectOptions } from "../../dom/overlay"
import { createService } from "../../machine/service"

const overlay = vi.hoisted(() => ({
  calls: [] as unknown[],
  stops: [] as (() => void)[],
}))
vi.mock("../../dom/overlay", () => ({
  overlayEffect: (_env: unknown, options: unknown) => {
    overlay.calls.push(options)
    const stop = vi.fn()
    overlay.stops.push(stop)
    return stop
  },
}))

import {
  buildDialogMachine,
  DIALOG_PARENT_KINDS,
  type DialogEvent,
  type DialogProps,
  dialogMachine,
  layerIdOf,
} from "./dialog.machine"

const lastOptions = () => overlay.calls[overlay.calls.length - 1] as OverlayEffectOptions

const quietEnv = {
  dom: { getById: () => null },
  modality: { modality: () => "keyboard" },
  scheduler: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
}

function make(over: Partial<DialogProps> = {}, env: object = quietEnv) {
  const onOpenChange = vi.fn()
  let props: DialogProps = { root: "r", onOpenChange, ...over }
  const s = createService(dialogMachine, props as never, env as never)
  s.start()
  return {
    s,
    onOpenChange,
    state: () => s.getSnapshot().state,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    ctx: () =>
      s.getSnapshot().context as {
        opener: string | null
        closeReason: string | null
      },
    send: (e: DialogEvent) => s.send(e as never),
    setProps: (p: Partial<DialogProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

const trigger = (id = "t1") =>
  ({ type: "TRIGGER_PRESS", trigger: id, modality: "pointer" }) as const
const closePress = { type: "CLOSE_TRIGGER_PRESS", modality: "pointer" } as const
const dismissal = (type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED") =>
  ({ type, request: dismissRequest("escape-key", undefined, null) }) as DialogEvent

beforeEach(() => {
  overlay.calls.length = 0
  overlay.stops.length = 0
})

describe("transitions", () => {
  it("starts closed; TRIGGER_PRESS opens and reports the event", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    m.send(trigger())
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[1]).toMatchObject({
      reason: "trigger",
      event: { type: "TRIGGER_PRESS" },
    })
  })

  it("OPEN opens", () => {
    const m = make()
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("api")
  })

  it("defaultOpen starts open", () => {
    expect(make({ defaultOpen: true }).state()).toBe("open")
  })

  it.each([
    ["CLOSE_TRIGGER_PRESS", "close-trigger", closePress],
    ["ESCAPE_KEY", "escape-key", dismissal("ESCAPE_KEY")],
    ["OUTSIDE_PRESS", "outside-press", dismissal("OUTSIDE_PRESS")],
    ["OUTSIDE_FOCUS", "outside-focus", dismissal("OUTSIDE_FOCUS")],
    ["PARENT_DISMISSED", "parent-dismissed", dismissal("PARENT_DISMISSED")],
    ["CLOSE", "api", { type: "CLOSE" } as DialogEvent],
  ])("%s closes an open dialog, reporting reason %s", (_name, reason, event) => {
    const m = make({ defaultOpen: true })
    m.send(event as DialogEvent)
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe(reason)
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("close events are ignored while closed", () => {
    const m = make()
    for (const e of [closePress, dismissal("ESCAPE_KEY"), { type: "CLOSE" } as const]) {
      m.send(e as DialogEvent)
    }
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("OPEN while open is ignored", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a modal dialog's trigger does not toggle it closed; a non-modal one does", () => {
    const modal = make({ defaultOpen: true })
    modal.send(trigger())
    expect(modal.state()).toBe("open")
    const non = make({ defaultOpen: true, modal: false })
    non.send(trigger())
    expect(non.state()).toBe("closed")
    expect(non.ctx().closeReason).toBe("trigger")
  })
})

describe("controlled open", () => {
  it("a press is a proposal: a parent that keeps open={true} leaves the dialog open", () => {
    const m = make({ open: true })
    m.send(closePress)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("close-trigger")
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("applying the proposal closes it", () => {
    const m = make({ open: true })
    m.send(dismissal("ESCAPE_KEY"))
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
  })

  it("a parent-driven change moves the state without calling onOpenChange", () => {
    const m = make({ open: false })
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a $sync close is not a reason: it does not set one, and opening clears the last", () => {
    const m = make({ open: true })
    m.setProps({ open: false })
    expect(m.ctx().closeReason).toBeNull()
    m.send({ type: "OPEN" }) // proposal refused (controlled): still closed
    m.setProps({ open: true })
    expect(m.ctx().closeReason).toBeNull()
  })

  // Source bug candidate: a controlled parent that applies the proposal closes the machine
  // through $sync, whose event is not a reason, so the proposal's reason is lost
  // (data-close-reason / closeReason() stay empty for controlled dialogs).
  it("a controlled close the parent applies keeps the proposal's reason", () => {
    const m = make({ open: true })
    m.send(dismissal("ESCAPE_KEY"))
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("escape-key")
  })
})

describe("cancel()", () => {
  it("onOpenChange cancelling a CLOSE_TRIGGER_PRESS keeps it open", () => {
    const onOpenChange = vi.fn((_open: boolean, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultOpen: true, onOpenChange: onOpenChange as never })
    m.send(closePress)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("cancelling an open request keeps it closed", () => {
    const m = make({ onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never })
    m.send(trigger())
    expect(m.state()).toBe("closed")
  })
})

describe("one task", () => {
  it("open then close synchronously ends closed (zag#3324)", () => {
    const m = make()
    m.send({ type: "OPEN" })
    m.send({ type: "CLOSE" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false])
  })

  it("requests are processed in order", () => {
    const m = make()
    m.send({ type: "OPEN" })
    m.send({ type: "CLOSE" })
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange.mock.calls.map((c) => c[1].reason)).toEqual(["api", "api", "api"])
  })
})

describe("closeReason and opener", () => {
  it("TRIGGER_PRESS sets the opener; OPEN leaves it null", () => {
    const a = make()
    a.send(trigger("t2"))
    expect(a.ctx().opener).toBe("t2")
    const b = make()
    b.send({ type: "OPEN" })
    expect(b.ctx().opener).toBeNull()
    const c = make({ open: false })
    c.setProps({ open: true })
    expect(c.ctx().opener).toBeNull()
  })

  it("the opener is reset by the next open", () => {
    const m = make()
    m.send(trigger("t1"))
    m.send(closePress)
    m.send({ type: "OPEN" })
    expect(m.ctx().opener).toBeNull()
  })

  it("the close reason is cleared when it opens again", () => {
    const m = make()
    m.send(trigger())
    m.send(dismissal("OUTSIDE_PRESS"))
    expect(m.ctx().closeReason).toBe("outside-press")
    m.send(trigger())
    expect(m.ctx().closeReason).toBeNull()
  })
})

describe("guards", () => {
  it("closeOnEscape false ignores ESCAPE_KEY", () => {
    const m = make({ defaultOpen: true, closeOnEscape: false })
    m.send(dismissal("ESCAPE_KEY"))
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("closeOnInteractOutside: default follows modal, an explicit value wins", () => {
    const press = dismissal("OUTSIDE_PRESS")
    const cases: [Partial<DialogProps>, string][] = [
      [{}, "closed"],
      [{ modal: false }, "open"],
      [{ closeOnInteractOutside: false }, "open"],
      [{ modal: false, closeOnInteractOutside: true }, "closed"],
    ]
    for (const [over, expected] of cases) {
      const m = make({ defaultOpen: true, ...over })
      m.send(press)
      expect(m.state(), JSON.stringify(over)).toBe(expected)
    }
  })

  it("other dismissals are not guarded by the options", () => {
    const m = make({ defaultOpen: true, closeOnEscape: false, closeOnInteractOutside: false })
    m.send(dismissal("PARENT_DISMISSED"))
    expect(m.state()).toBe("closed")
  })
})

describe("overlay effect wiring", () => {
  const request = (reason: DismissRequest["reason"]) => dismissRequest(reason, undefined, null)

  it("starts on open with the dialog kind, family, parent kinds and modality options", () => {
    const m = make({ parent: "p" as never })
    expect(overlay.calls).toHaveLength(0)
    m.send(trigger())
    const o = lastOptions()
    expect(o).toMatchObject({
      id: layerIdOf("dialog", "r"),
      kind: "dialog",
      family: "dialog",
      modal: true,
      parent: "p",
      parentKinds: DIALOG_PARENT_KINDS,
      dismiss: { escape: true, outsidePress: true, outsideFocus: false },
    })
    expect(DIALOG_PARENT_KINDS).toEqual(["dialog", "alertdialog", "drawer", "popover", "tour"])
  })

  it("stops when the dialog closes", () => {
    const m = make()
    m.send(trigger())
    m.send(closePress)
    expect(overlay.stops[0]).toHaveBeenCalledTimes(1)
  })

  it("non-modal and closeOnEscape options reach the overlay", () => {
    make({ defaultOpen: true, modal: false, closeOnEscape: false })
    expect(lastOptions()).toMatchObject({
      modal: false,
      dismiss: { escape: false, outsidePress: false, outsideFocus: false },
    })
    make({ defaultOpen: true, modal: false, closeOnInteractOutside: true })
    expect(lastOptions().dismiss.outsidePress).toBe(true)
  })

  it("initialFocus and finalFocus map to the overlay options", () => {
    const fn = () => null
    make({ defaultOpen: true })
    expect(lastOptions().initialFocus).toBeUndefined()
    expect(lastOptions().finalFocus).toBeUndefined()
    make({ defaultOpen: true, initialFocus: false, finalFocus: false })
    expect(lastOptions().initialFocus?.()).toBe(false)
    expect(lastOptions().finalFocus?.(undefined)).toBe(false)
    make({ defaultOpen: true, initialFocus: fn })
    expect(lastOptions().initialFocus).toBe(fn)
    const final = vi.fn(() => null)
    const m = make({ defaultOpen: true, finalFocus: final })
    m.send(dismissal("ESCAPE_KEY"))
    lastOptions().finalFocus?.("escape-key")
    expect(final).toHaveBeenCalledWith("escape-key")
  })

  it("a dismissal request sends the mapped event and closes", () => {
    const m = make({ defaultOpen: true })
    const r = request("outside-press")
    lastOptions().dismiss.onRequest(r)
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("outside-press")
    expect(r.canceled).toBe(false)
  })

  it("onEscapeKeyDown / onInteractOutside can veto: nothing is sent, nothing beneath closes", () => {
    const onEscapeKeyDown = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    const onInteractOutside = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    const m = make({
      defaultOpen: true,
      onEscapeKeyDown: onEscapeKeyDown as never,
      onInteractOutside: onInteractOutside as never,
    })
    const esc = request("escape-key")
    lastOptions().dismiss.onRequest(esc)
    const out = request("outside-press")
    lastOptions().dismiss.onRequest(out)
    expect(onEscapeKeyDown).toHaveBeenCalledTimes(1)
    expect(onInteractOutside).toHaveBeenCalledTimes(1)
    expect(esc.canceled).toBe(true)
    expect(out.canceled).toBe(true)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("parent-dismissed is not vetoable by the outside handlers", () => {
    const onInteractOutside = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    const m = make({ defaultOpen: true, onInteractOutside: onInteractOutside as never })
    lastOptions().dismiss.onRequest(request("parent-dismissed"))
    expect(onInteractOutside).not.toHaveBeenCalled()
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("parent-dismissed")
  })

  it("a controlled parent that keeps it open cancels the dismissal for the layers beneath", () => {
    const m = make({ open: true })
    const r = request("escape-key")
    lastOptions().dismiss.onRequest(r)
    expect(m.state()).toBe("open")
    expect(r.canceled).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("escape-key")
  })
})

describe("nameCheck effect", () => {
  function withContent(attrs: Record<string, string>) {
    const frames: (() => void)[] = []
    const el = { id: "dialog-r-content", getAttribute: (n: string) => attrs[n] ?? null }
    const env = {
      ...quietEnv,
      dom: { getById: (id: string) => (id === "dialog-r-content" ? el : null) },
      scheduler: {
        requestAnimationFrame: (cb: () => void) => frames.push(cb),
        cancelAnimationFrame: () => {},
      },
    }
    return {
      env,
      flush: () => {
        for (const f of frames.splice(0)) f()
      },
    }
  }

  it("warns once, a frame after open, when there is no title, aria-label or aria-labelledby", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { env, flush } = withContent({})
    make({ defaultOpen: true }, env)
    expect(warn).not.toHaveBeenCalled()
    flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("dialog-r-content")
    warn.mockRestore()
  })

  it.each([
    ["aria-label", { "aria-label": "Settings" }],
    ["aria-labelledby", { "aria-labelledby": "x" }],
  ])("does not warn with %s", (_n, attrs) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { env, flush } = withContent(attrs)
    make({ defaultOpen: true }, env)
    flush()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("nameCheck reads the content at the frame", () => {
  // The title's aria-labelledby can appear after the effect started (Strict Mode,
  // hydration): the check reads the content's attributes when the frame runs.
  it("does not warn when the title's aria-labelledby appears after the effect started", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const frames: (() => void)[] = []
    let labelledBy: string | null = null
    const el = {
      id: "dialog-r-content",
      getAttribute: (n: string) => (n === "aria-labelledby" ? labelledBy : null),
    }
    const env = {
      ...quietEnv,
      dom: { getById: () => el },
      scheduler: {
        requestAnimationFrame: (cb: () => void) => frames.push(cb),
        cancelAnimationFrame: () => {},
      },
    }
    make({ defaultOpen: true }, env)
    labelledBy = "dialog-r-title"
    for (const f of frames.splice(0)) f()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("buildDialogMachine", () => {
  it("builds machines of another kind from the same graph", () => {
    const other = buildDialogMachine({ scope: "alert-dialog", kind: "alertdialog" })
    expect(Object.keys(other.def.states)).toEqual(Object.keys(dialogMachine.def.states))
    const s = createService(other, { root: "a", defaultOpen: true } as never, quietEnv as never)
    s.start()
    expect(lastOptions()).toMatchObject({ kind: "alertdialog", id: "alert-dialog-a" })
    s.stop()
  })
})
