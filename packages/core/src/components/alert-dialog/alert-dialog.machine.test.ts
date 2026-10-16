// The Alert Dialog machine in Node (openspec add-alert-dialog 1.3): every transition,
// Cancel and Action as close parts, controlled refusal, cancel() on an action, no outside
// press transition, initial focus resolved from the live content, the description warning.
// The overlay effect is replaced by a recorder, as in the Dialog machine tests.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { dismissRequest } from "../../dom/dismiss"
import type { OverlayEffectOptions } from "../../dom/overlay"
import { createService } from "../../machine/service"

const overlay = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock("../../dom/overlay", () => ({
  overlayEffect: (_env: unknown, options: unknown) => {
    overlay.calls.push(options)
    return vi.fn()
  },
}))

import type { DialogEvent, DialogProps } from "../dialog/dialog.machine"
import { alertDialogMachine } from "./alert-dialog.machine"

const lastOptions = () => overlay.calls[overlay.calls.length - 1] as OverlayEffectOptions

const quietEnv = {
  dom: { getById: () => null },
  modality: { modality: () => "keyboard" },
  scheduler: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
}

function make(over: Partial<DialogProps> = {}, env: object = quietEnv) {
  const onOpenChange = vi.fn()
  let props: DialogProps = { root: "r", onOpenChange, ...over }
  const s = createService(alertDialogMachine, props as never, env as never)
  s.start()
  return {
    s,
    onOpenChange,
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context as { opener: string | null; closeReason: string | null },
    send: (e: DialogEvent) => s.send(e as never),
    setProps: (p: Partial<DialogProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

const trigger = { type: "TRIGGER_PRESS", trigger: "t1", modality: "pointer" } as const
const cancelPress = { type: "CANCEL_PRESS", modality: "pointer" } as const
const actionPress = { type: "ACTION_PRESS", action: "a1", modality: "pointer" } as const
const dismissal = (type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED") =>
  ({ type, request: dismissRequest("escape-key", undefined, null) }) as DialogEvent

beforeEach(() => {
  overlay.calls.length = 0
})

describe("transitions", () => {
  it("starts closed; TRIGGER_PRESS opens, OPEN opens, defaultOpen starts open", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    m.send(trigger)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("TRIGGER_PRESS")
    const o = make()
    o.send({ type: "OPEN" })
    expect(o.state()).toBe("open")
    expect(make({ defaultOpen: true }).state()).toBe("open")
  })

  it.each([
    ["CANCEL_PRESS", cancelPress],
    ["ACTION_PRESS", actionPress],
    ["ESCAPE_KEY", dismissal("ESCAPE_KEY")],
    ["OUTSIDE_FOCUS", dismissal("OUTSIDE_FOCUS")],
    ["PARENT_DISMISSED", dismissal("PARENT_DISMISSED")],
    ["CLOSE", { type: "CLOSE" } as DialogEvent],
  ])("%s closes an open alert dialog, reporting it as the reason", (reason, event) => {
    const m = make({ defaultOpen: true })
    m.send(event as DialogEvent)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe(reason)
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("close events are ignored while closed", () => {
    const m = make()
    for (const e of [cancelPress, actionPress, dismissal("ESCAPE_KEY"), { type: "CLOSE" } as const])
      m.send(e as DialogEvent)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("OPEN while open is ignored", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "OPEN" })
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("CLOSE_TRIGGER_PRESS is not a close part of the alert dialog", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" })
    expect(m.state()).toBe("open")
  })

  it("the trigger never toggles it closed (always modal)", () => {
    const m = make({ defaultOpen: true })
    m.send(trigger)
    expect(m.state()).toBe("open")
  })

  it("the opener is the trigger; the close reason clears on the next open", () => {
    const m = make()
    m.send(trigger)
    expect(m.ctx().opener).toBe("t1")
    m.send(cancelPress)
    expect(m.ctx().closeReason).toBe("CANCEL_PRESS")
    m.send(trigger)
    expect(m.ctx().closeReason).toBeNull()
  })
})

describe("no outside-press transition", () => {
  it("OUTSIDE_PRESS stays open and reports nothing", () => {
    const m = make({ defaultOpen: true })
    m.send(dismissal("OUTSIDE_PRESS"))
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("an explicit closeOnInteractOutside is ignored (and modal: false too)", () => {
    const m = make({ defaultOpen: true, closeOnInteractOutside: true, modal: false })
    m.send(dismissal("OUTSIDE_PRESS"))
    m.send(trigger)
    expect(m.state()).toBe("open")
    expect(lastOptions()).toMatchObject({
      modal: true,
      dismiss: { escape: true, outsidePress: false, outsideFocus: false },
    })
  })

  it("closeOnEscape false ignores ESCAPE_KEY", () => {
    const m = make({ defaultOpen: true, closeOnEscape: false })
    m.send(dismissal("ESCAPE_KEY"))
    expect(m.state()).toBe("open")
    expect(lastOptions().dismiss.escape).toBe(false)
  })
})

describe("controlled open and cancel()", () => {
  it.each([
    ["CANCEL_PRESS", cancelPress],
    ["ACTION_PRESS", actionPress],
  ])("%s is a proposal: a parent keeping open={true} leaves it open", (reason, event) => {
    const m = make({ open: true })
    m.send(event)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe(reason)
    expect(m.state()).toBe("open")
  })

  it("applying the proposal closes it", () => {
    const m = make({ open: true })
    m.send(cancelPress)
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
  })

  // Same expectation as the Dialog's controlled-reason test: the proposal's reason survives.
  it("a controlled close the parent applies keeps the proposal's reason", () => {
    const m = make({ open: true })
    m.send(cancelPress)
    m.setProps({ open: false })
    expect(m.ctx().closeReason).toBe("CANCEL_PRESS")
  })

  it("ACTION_PRESS cancelled with details.cancel() keeps it open; a later CLOSE closes it", () => {
    const onOpenChange = vi.fn((_o: boolean, d: { cancel(): void; reason: string }) => {
      if (d.reason === "ACTION_PRESS") d.cancel()
    })
    const m = make({ defaultOpen: true, onOpenChange: onOpenChange as never })
    m.send(actionPress)
    expect(m.state()).toBe("open")
    m.send({ type: "CLOSE" })
    expect(m.state()).toBe("closed")
    expect(onOpenChange.mock.calls.map((c) => c[1].reason)).toEqual(["ACTION_PRESS", "CLOSE"])
    expect(m.ctx().closeReason).toBe("CLOSE")
  })

  it("a parent-driven change moves the state without onOpenChange", () => {
    const m = make({ open: false })
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })
})

describe("overlay effect wiring", () => {
  it("is an alertdialog layer, always modal, with the dialog family and parent kinds", () => {
    make({ defaultOpen: true, parent: "p" as never })
    expect(lastOptions()).toMatchObject({
      id: "alert-dialog-r",
      kind: "alertdialog",
      family: "dialog",
      modal: true,
      parent: "p",
    })
    expect(lastOptions().parentKinds).toEqual(["dialog", "alertdialog", "drawer", "popover"])
  })

  it("onEscapeKeyDown can veto Escape (radix#2227); an outside request is never sent", () => {
    const onEscapeKeyDown = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    const m = make({ defaultOpen: true, onEscapeKeyDown: onEscapeKeyDown as never })
    const esc = dismissRequest("escape-key", undefined, null)
    lastOptions().dismiss.onRequest(esc)
    expect(esc.canceled).toBe(true)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("an outside press request reaching the machine leaves it open and cancels the request", () => {
    const m = make({ defaultOpen: true })
    const r = dismissRequest("outside-press", undefined, null)
    lastOptions().dismiss.onRequest(r)
    expect(m.state()).toBe("open")
    expect(r.canceled).toBe(true)
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("Escape closes with ESCAPE_KEY", () => {
    const m = make({ defaultOpen: true })
    lastOptions().dismiss.onRequest(dismissRequest("escape-key", undefined, null))
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("ESCAPE_KEY")
  })
})

describe("initialFocus", () => {
  const contentWith = (cancel: object | null) => ({
    id: "alert-dialog-r-content",
    getAttribute: () => null,
    // The machine asks for an enabled Cancel (disabled ones cannot take focus).
    querySelector: (sel: string) => (sel.startsWith('[data-part="cancel"]') ? cancel : null),
  })
  const envWith = (content: () => unknown) => ({
    ...quietEnv,
    dom: { getById: (id: string) => (id === "alert-dialog-r-content" ? content() : null) },
  })

  it('defaults to "cancel": the Cancel element inside the content', () => {
    const cancel = { id: "c" }
    make(
      { defaultOpen: true },
      envWith(() => contentWith(cancel)),
    )
    expect(lastOptions().initialFocus?.()).toBe(cancel)
  })

  it("falls back to the content when there is no cancel part", () => {
    const content = contentWith(null)
    make(
      { defaultOpen: true },
      envWith(() => content),
    )
    expect(lastOptions().initialFocus?.()).toBe(content)
  })

  it("resolves from the live content when called, never a replaced node (bits-ui#2136)", () => {
    const first = { id: "old" }
    const second = { id: "new" }
    let current = contentWith(first)
    make(
      { defaultOpen: true },
      envWith(() => current),
    )
    current = contentWith(second)
    expect(lastOptions().initialFocus?.()).toBe(second)
  })

  it("is null when the content is gone", () => {
    make(
      { defaultOpen: true },
      envWith(() => null),
    )
    expect(lastOptions().initialFocus?.()).toBeNull()
  })

  it("an explicit initialFocus wins over the default", () => {
    make({ defaultOpen: true, initialFocus: false })
    expect(lastOptions().initialFocus?.()).toBe(false)
    const fn = () => null
    make({ defaultOpen: true, initialFocus: fn })
    expect(lastOptions().initialFocus).toBe(fn)
  })
})

describe("nameCheck: title and description", () => {
  function withContent(attrs: Record<string, string>) {
    const frames: (() => void)[] = []
    const el = { id: "alert-dialog-r-content", getAttribute: (n: string) => attrs[n] ?? null }
    const env = {
      ...quietEnv,
      dom: { getById: (id: string) => (id === "alert-dialog-r-content" ? el : null) },
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
  const spy = () => vi.spyOn(console, "warn").mockImplementation(() => {})

  it("a missing description warns once, a frame after open", () => {
    const warn = spy()
    const { env, flush } = withContent({ "aria-labelledby": "t" })
    make({ defaultOpen: true }, env)
    expect(warn).not.toHaveBeenCalled()
    flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("description")
    warn.mockRestore()
  })

  it("a missing title warns (and the description too, one warning per item)", () => {
    const warn = spy()
    const { env, flush } = withContent({ "aria-describedby": "d" })
    make({ defaultOpen: true }, env)
    flush()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("accessible name")
    warn.mockRestore()

    const both = spy()
    const e2 = withContent({})
    make({ defaultOpen: true }, e2.env)
    e2.flush()
    expect(both).toHaveBeenCalledTimes(2)
    both.mockRestore()
  })

  it("no warning with a name and a description", () => {
    const warn = spy()
    const { env, flush } = withContent({ "aria-label": "Delete?", "aria-describedby": "d" })
    make({ defaultOpen: true }, env)
    flush()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
