// add-tour 1.3, 2.4: the Tour machine in Node. Without a document the DOM effects (layer,
// positioning, painting) are no-ops and anchored targets never resolve, so the flow, the
// visit hand-off, the effects' exit paths, the missing-target policies and the controlled
// values run on the real machine with a fake scheduler (fake time, no waiting).
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  resolveStep,
  type TourContext,
  type TourEvent,
  type TourProps,
  tourMachine,
} from "./tour.machine"
import { tourMessages } from "./tour.messages"
import type { TourStep } from "./tour.steps"

function fakeScheduler() {
  let next = 1
  const timers = new Map<number, () => void>()
  return {
    timers,
    setTimeout: (cb: () => void) => {
      timers.set(next, cb)
      return next++
    },
    clearTimeout: (h: unknown) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    /** Fires every pending timer (the step timeouts). */
    fireAll() {
      for (const [h, cb] of [...timers]) {
        timers.delete(h)
        cb()
      }
    },
  }
}

const dialog = (id: string, over: Partial<TourStep> = {}): TourStep => ({ id, ...over })
const anchored = (id: string, over: Partial<TourStep> = {}): TourStep => ({
  id,
  // Never rendered in Node: the step is always "missing".
  target: () => null,
  ...over,
})

function make(over: Partial<TourProps> = {}) {
  const scheduler = fakeScheduler()
  const announce = vi.fn()
  const env = {
    dom: { getById: () => null, getRootNode: () => ({}), activeElement: () => null },
    modality: { modality: () => "pointer" },
    motion: { reducedMotion: () => false },
    announcer: { announce, prepare: () => () => {}, cancel: () => {} },
    scheduler,
    position: { reposition: vi.fn(), track: () => ({ stop() {}, reposition() {} }) },
  }
  const onOpenChange = vi.fn()
  const onStepIdChange = vi.fn()
  let props: TourProps = {
    root: "t",
    steps: [dialog("a"), dialog("b"), dialog("c")],
    messages: tourMessages,
    onOpenChange,
    onStepIdChange,
    ...over,
  }
  const s = createService(tourMachine, props as never, env as never)
  s.start()
  const view = () => s.view() as unknown as { values: { open: boolean; stepId: string } }
  return {
    s,
    scheduler,
    onOpenChange,
    onStepIdChange,
    state: () => s.getSnapshot().state,
    open: () => view().values.open,
    stepId: () => view().values.stepId,
    ctx: () => s.getSnapshot().context as TourContext,
    send: (e: TourEvent) => s.send(e as never),
    setProps: (p: Partial<TourProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    reasons: () => onOpenChange.mock.calls.map(([, d]) => (d as { reason: string }).reason),
  }
}

const start = (stepId?: string): TourEvent => ({ type: "START", stepId })
const next: TourEvent = { type: "STEP.NEXT" }
const prev: TourEvent = { type: "STEP.PREV" }

describe("steps", () => {
  it("duplicate ids throw an error naming the id", () => {
    expect(() => make({ steps: [dialog("intro"), dialog("intro")] })).toThrow(/"intro"/)
  })

  it("type is inferred from the target", async () => {
    const { stepType } = await import("./tour.steps")
    expect(stepType(anchored("x"))).toBe("tooltip")
    expect(stepType(dialog("y"))).toBe("dialog")
  })
})

describe("open state and current step", () => {
  it("start shows the first step synchronously (no preparing render for a sync step)", () => {
    const t = make()
    t.send(start())
    expect(t.state()).toBe("active")
    expect(t.stepId()).toBe("a")
    expect(t.onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: "START" }))
    expect(t.onStepIdChange).toHaveBeenCalledTimes(1)
  })

  it("start({ stepId }) begins there; start() after a stop begins at the first step", () => {
    const t = make()
    t.send(start("b"))
    expect(t.stepId()).toBe("b")
    t.send(next)
    expect(t.stepId()).toBe("c")
    t.send({ type: "api" })
    expect(t.state()).toBe("idle")
    t.send(start())
    expect(t.stepId()).toBe("a")
  })

  it("next / prev walk the steps; Back at the first does nothing; Next on the last completes", () => {
    const t = make()
    t.send(start())
    t.send(prev)
    expect(t.stepId()).toBe("a")
    t.send(next)
    t.send(next)
    expect(t.stepId()).toBe("c")
    t.send(prev)
    expect(t.stepId()).toBe("b")
    t.send(next)
    t.send(next)
    expect(t.state()).toBe("idle")
    expect(t.reasons().at(-1)).toBe("complete")
    expect(t.ctx().closeReason).toBe("complete")
  })

  it("Back skips wait steps", () => {
    const t = make({
      steps: [dialog("intro"), dialog("wait-for-input", { type: "wait" }), dialog("result")],
    })
    t.send(start("result"))
    t.send(prev)
    expect(t.stepId()).toBe("intro")
  })

  it("goto with an unknown id logs and does nothing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const t = make()
    t.send(start())
    t.send({ type: "STEP.GOTO", id: "nope" })
    expect(t.stepId()).toBe("a")
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it("controlled refusal: open stays false, only onOpenChange(true) is called", () => {
    const t = make({ open: false })
    t.send(start())
    expect(t.onOpenChange).toHaveBeenCalledWith(true, expect.anything())
    expect(t.state()).toBe("idle")
  })

  it("controlled step: Next proposes the next id and the shown step waits for the parent", () => {
    const t = make({ stepId: "a" })
    t.send(start())
    expect(t.stepId()).toBe("a")
    t.onStepIdChange.mockClear()
    t.send(next)
    expect(t.onStepIdChange).toHaveBeenCalledWith("b", expect.anything())
    expect(t.stepId()).toBe("a")
    t.setProps({ stepId: "b" })
    expect(t.stepId()).toBe("b")
    expect(t.state()).toBe("active")
  })

  it("cancel() keeps the current state", () => {
    const t = make()
    t.send(start())
    t.onOpenChange.mockImplementation((_open, details) => details.cancel())
    t.send({ type: "escape-key" })
    expect(t.state()).toBe("active")
  })

  it("close reasons: dismiss, skip, escape-key, api; dismiss on the last step completes", () => {
    for (const type of ["dismiss", "skip", "escape-key", "api"] as const) {
      const t = make()
      t.send(start())
      t.send({ type } as TourEvent)
      expect(t.reasons().at(-1)).toBe(type)
    }
    const t = make()
    t.send(start("c"))
    t.send({ type: "dismiss" })
    expect(t.reasons().at(-1)).toBe("complete")
  })

  it("Escape disabled and outside press / focus off by default do nothing", () => {
    const t = make({ closeOnEscape: false })
    t.send(start())
    t.send({ type: "escape-key" })
    t.send({ type: "outside-press" })
    t.send({ type: "outside-focus" })
    expect(t.state()).toBe("active")
    const u = make({ closeOnOutsidePress: true })
    u.send(start())
    u.send({ type: "outside-press" })
    expect(u.reasons().at(-1)).toBe("outside-press")
  })
})

describe("step effects and the visit", () => {
  it("an async effect: preparing until show(), update() applied before the card appears", async () => {
    let show = () => {}
    const steps = [
      dialog("a"),
      dialog("b", {
        effect: ({ show: s, update }) => {
          show = () => {
            update({ description: "updated" })
            s()
          }
          return new Promise(() => {})
        },
      }),
    ]
    const t = make({ steps })
    t.send(start())
    t.send(next)
    expect(t.state()).toBe("preparing")
    show()
    expect(t.state()).toBe("active")
    expect(resolveStep({ steps }, t.ctx().patches, "b")?.description).toBe("updated")
  })

  it("double Next while preparing advances one step; the step after never runs its effect", () => {
    const third = vi.fn()
    const t = make({
      steps: [
        dialog("a"),
        dialog("b", { effect: () => new Promise(() => {}) }),
        dialog("c", { effect: third }),
      ],
    })
    t.send(start())
    t.send(next)
    t.send(next)
    expect(t.state()).toBe("preparing")
    expect(t.ctx().pendingId).toBe("b")
    expect(third).not.toHaveBeenCalled()
  })

  it("a plain effect that returns without show() shows the step", () => {
    const t = make({ steps: [dialog("a", { effect: () => undefined })] })
    t.send(start())
    expect(t.state()).toBe("active")
  })

  it("cleanup runs exactly once on every exit path", () => {
    const paths: [string, (t: ReturnType<typeof make>) => void][] = [
      ["next", (t) => t.send(next)],
      ["back", (t) => t.send(prev)],
      ["goto", (t) => t.send({ type: "STEP.GOTO", id: "a" })],
      ["skip", (t) => t.send({ type: "skip" })],
      ["dismiss", (t) => t.send({ type: "dismiss" })],
      ["escape", (t) => t.send({ type: "escape-key" })],
      ["stop", (t) => t.send({ type: "api" })],
      ["unmount", (t) => t.s.stop()],
      ["steps removed", (t) => t.setProps({ steps: [dialog("a"), dialog("c")] })],
    ]
    for (const [name, leave] of paths) {
      const cleanup = vi.fn()
      const t = make({ steps: [dialog("a"), dialog("b", { effect: () => cleanup }), dialog("c")] })
      t.send(start("b"))
      expect(t.stepId(), name).toBe("b")
      leave(t)
      expect(cleanup, name).toHaveBeenCalledTimes(1)
    }
  })

  it("dismiss() from inside the effect runs the cleanup once and reports the reason", () => {
    const cleanup = vi.fn()
    let dismiss = () => {}
    const t = make({
      steps: [
        dialog("a", {
          effect: ({ dismiss: d, show }) => {
            dismiss = d
            show()
            return cleanup
          },
        }),
      ],
    })
    t.send(start())
    dismiss()
    expect(t.state()).toBe("idle")
    expect(cleanup).toHaveBeenCalledTimes(1)
    // The single step is the last one: dismiss on it completes.
    expect(t.reasons().at(-1)).toBe("complete")
  })

  it("left before the effect finished: signal aborted, a late cleanup runs at once, show() ignored", async () => {
    let resolve: (fn: () => void) => void = () => {}
    let signal: AbortSignal | undefined
    let show = () => {}
    const t = make({
      steps: [
        dialog("a"),
        dialog("b", {
          effect: (args) => {
            signal = args.signal
            show = args.show
            return new Promise<() => void>((r) => (resolve = r))
          },
        }),
      ],
    })
    t.send(start())
    t.send(next)
    t.send({ type: "api" })
    expect(signal?.aborted).toBe(true)
    const cleanup = vi.fn()
    resolve(cleanup)
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1))
    show()
    expect(t.state()).toBe("idle")
  })

  it("a throwing effect is logged and applies the missing-target policy", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const onMissingTarget = vi.fn()
    const t = make({
      onMissingTarget,
      steps: [
        dialog("a"),
        dialog("b", {
          effect: () => {
            throw new Error("boom")
          },
        }),
        dialog("c"),
      ],
    })
    t.send(start())
    t.send(next)
    expect(t.stepId()).toBe("c")
    expect(onMissingTarget).toHaveBeenCalledWith({ stepId: "b", policy: "skip" })
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it("a re-created steps array with the same ids does not restart the effect", () => {
    const effect = vi.fn(() => undefined)
    const steps = () => [dialog("a", { effect })]
    const t = make({ steps: steps() })
    t.send(start())
    t.setProps({ steps: steps() })
    t.setProps({ steps: steps() })
    expect(effect).toHaveBeenCalledTimes(1)
    expect(t.state()).toBe("active")
  })

  it("the current step removed from steps ends the tour with steps-changed", () => {
    const t = make()
    t.send(start("b"))
    t.setProps({ steps: [dialog("a"), dialog("c")] })
    expect(t.state()).toBe("idle")
    expect(t.reasons().at(-1)).toBe("steps-changed")
  })

  it("Strict Mode: stop() and start() keep one first-step change and re-run the effect", () => {
    const effect = vi.fn(() => undefined)
    const t = make({ steps: [dialog("a", { effect }), dialog("b")] })
    t.send(start())
    expect(t.onStepIdChange).toHaveBeenCalledTimes(1)
    t.s.stop()
    t.s.start()
    expect(t.state()).toBe("active")
    expect(t.stepId()).toBe("a")
    expect(t.onStepIdChange).toHaveBeenCalledTimes(1)
    expect(effect).toHaveBeenCalledTimes(2)
  })
})

describe("wait steps", () => {
  it("a wait step waits; its effect's next() moves on; Escape closes it and runs the cleanup", () => {
    let go = () => {}
    const cleanup = vi.fn()
    const steps = [
      dialog("a"),
      dialog("w", {
        type: "wait",
        effect: ({ next: n }) => {
          go = n
          return cleanup
        },
      }),
      dialog("c"),
    ]
    const t = make({ steps })
    t.send(start())
    t.send(next)
    expect(t.state()).toBe("waiting")
    go()
    expect(t.stepId()).toBe("c")
    expect(cleanup).toHaveBeenCalledTimes(1)

    const u = make({ steps })
    u.send(start("w"))
    u.send({ type: "escape-key" })
    expect(u.reasons().at(-1)).toBe("escape-key")
  })
})

describe("missing targets (fake time)", () => {
  it("skip (default) on a middle step moves on after the timeout", () => {
    const onMissingTarget = vi.fn()
    const t = make({ onMissingTarget, steps: [dialog("a"), anchored("b"), dialog("c")] })
    t.send(start())
    t.send(next)
    expect(t.state()).toBe("preparing")
    t.scheduler.fireAll()
    expect(t.stepId()).toBe("c")
    expect(onMissingTarget).toHaveBeenCalledWith({ stepId: "b", policy: "skip" })
  })

  it("the last step missing: Next before it completes the tour after the timeout", () => {
    const t = make({ steps: [dialog("a"), anchored("b")] })
    t.send(start())
    t.send(next)
    t.scheduler.fireAll()
    expect(t.state()).toBe("idle")
    expect(t.reasons().at(-1)).toBe("complete")
  })

  it("skip backward past the first step closes with target-missing", () => {
    const t = make({ steps: [anchored("a"), dialog("b")] })
    t.send(start("b"))
    t.send(prev)
    t.scheduler.fireAll()
    expect(t.reasons().at(-1)).toBe("target-missing")
  })

  it("stop closes with target-missing; center shows the step centred", () => {
    const t = make({ steps: [dialog("a"), anchored("b", { missingTarget: "stop" })] })
    t.send(start())
    t.send(next)
    t.scheduler.fireAll()
    expect(t.reasons().at(-1)).toBe("target-missing")

    const u = make({ steps: [dialog("a"), anchored("b", { missingTarget: "center" })] })
    u.send(start())
    u.send(next)
    u.scheduler.fireAll()
    expect(u.state()).toBe("active")
    expect(u.stepId()).toBe("b")
    expect(u.ctx().targetMissing).toBe(true)
  })

  it("the step timeout wins over prepareTimeout and nothing waits without a target", () => {
    const t = make({ prepareTimeout: 1, steps: [dialog("a")] })
    t.send(start())
    expect(t.scheduler.timers.size).toBe(0)
  })
})
