import { afterEach, describe, expect, it, vi } from "vitest"
import type { Scheduler, SchedulerEnv } from "../env"
import { createService } from "./service"
import { bindProp, setup, type } from "./setup"
import type { ChangeDetails, Step } from "./types"

type Event = { type: "OPEN" } | { type: "CLOSE" } | { type: "TOGGLE" } | { type: "PING" }
interface Props {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: ChangeDetails<Event>) => void
  closeOnPing?: boolean
  delay?: number
  label?: string
}

/** A scheduler that resolves `setTimeout` on globalThis at call time, like domEnvironment. */
const scheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as number),
  requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 16),
  cancelAnimationFrame: (h) => globalThis.clearTimeout(h as number),
}

function make() {
  const log: string[] = []
  const machine = setup({
    types: type<{
      props: Props
      events: Event
      env: SchedulerEnv & { log: string[]; reads?: () => unknown }
      context: { count: number; lastLabel: string | undefined }
      values: "open"
    }>(),
    actions: {
      count: ({ set, context }) => set("count", context.count + 1),
      logEntry: ({ env }) => env.log.push("entry:open"),
      logExit: ({ env }) => env.log.push("exit:open"),
      logTransition: ({ env }) => env.log.push("transition"),
      pingFromEntry: ({ send }) => send({ type: "PING" }),
      resync: ({ env }) => env.log.push("reverted"),
    },
    guards: {
      closeOnPing: ({ props }) => props.closeOnPing === true,
      never: () => false,
    },
    effects: {
      track: ({ env }) => {
        env.log.push("effect:start")
        return () => env.log.push("effect:stop")
      },
      readLater: (args) => {
        args.env.reads = () => args.props.label
        return undefined
      },
      service: ({ env }) => {
        env.log.push("service:start")
        return () => env.log.push("service:stop")
      },
    },
    delays: { autoClose: ({ props }) => props.delay ?? 1000 },
  }).machine({
    id: "test",
    context: () => ({ count: 0, lastLabel: undefined }),
    values: { open: { fallback: false, states: { open: true, closed: false } } },
    initial: "closed",
    effects: ["service"],
    computed: { doubled: (view) => view.context.count * 2 },
    onProps: { label: "PING" },
    states: {
      closed: {
        tags: ["hidden"],
        on: { OPEN: { target: "open", actions: ["count"] }, TOGGLE: "open" },
      },
      open: {
        entry: ["logEntry"],
        exit: ["logExit"],
        effects: ["track", "readLater"],
        after: { autoClose: "closed" },
        on: {
          CLOSE: { target: "closed", actions: ["logTransition"] },
          TOGGLE: "closed",
          PING: [
            { guard: { and: ["closeOnPing", { not: "never" }] }, target: "closed" },
            { actions: ["count"] },
          ],
          $reverted: { actions: ["resync"] },
        },
      },
    },
  })
  const env: SchedulerEnv & { log: string[]; reads?: () => unknown } = { scheduler, log }
  return { machine, env, log }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("run-to-completion", () => {
  it("two sends in one tick are both processed in order", () => {
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    s.send({ type: "OPEN" })
    s.send({ type: "CLOSE" })
    expect(s.getSnapshot().state).toBe("closed")
  })

  it("a re-entrant send is processed before the outer send returns, with one notification", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "GO" } | { type: "NEXT" }; env: object }>(),
      actions: { next: ({ send }) => send({ type: "NEXT" }) },
    }).machine({
      id: "chain",
      initial: "a",
      states: { a: { on: { GO: "b" } }, b: { entry: ["next"], on: { NEXT: "c" } }, c: {} },
    })
    const s = createService(m, {}, {})
    const listener = vi.fn()
    s.subscribe(listener)
    s.send({ type: "GO" })
    expect(s.getSnapshot().state).toBe("c")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("orders exit, transition and entry actions, and cleans effects before entry", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { defaultOpen: true }, env)
    s.start()
    s.send({ type: "CLOSE" })
    s.send({ type: "OPEN" })
    expect(log).toEqual([
      "entry:open",
      "service:start",
      "effect:start",
      "exit:open",
      "effect:stop",
      "transition",
      "entry:open",
      "effect:start",
    ])
  })
})

describe("snapshots", () => {
  it("keeps the reference stable with no event in between", () => {
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    expect(s.getSnapshot()).toBe(s.getSnapshot())
  })

  it("does not change or notify for an event with no transition", () => {
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    const before = s.getSnapshot()
    const listener = vi.fn()
    s.subscribe(listener)
    s.send({ type: "CLOSE" })
    expect(s.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it("exposes resolved values, memoised computed values, matches and hasTag", () => {
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    s.send({ type: "OPEN" })
    const view = s.view()
    expect(view.values.open).toBe(true)
    expect(view.computed.doubled).toBe(2)
    expect(view.matches("open", "closed")).toBe(true)
    expect(view.hasTag("hidden")).toBe(false)
    expect(s.view()).toBe(view)
  })

  it("evaluates guarded alternatives in order, with combinators as data", () => {
    const { machine, env } = make()
    const s = createService(machine, { defaultOpen: true }, env)
    s.send({ type: "PING" })
    expect(s.getSnapshot()).toMatchObject({ state: "open", context: { count: 1 } })
    s.setProps({ defaultOpen: true, closeOnPing: true })
    s.send({ type: "PING" })
    expect(s.getSnapshot().state).toBe("closed")
  })
})

describe("controllable values", () => {
  it("uncontrolled: value and state change, onOpenChange is called during the send", () => {
    const { machine, env } = make()
    const calls: unknown[] = []
    const s = createService(
      machine,
      {
        onOpenChange: (open, details) => {
          calls.push([open, details.reason, s.getSnapshot().state])
        },
      },
      env,
    )
    s.send({ type: "OPEN" })
    expect(s.getSnapshot().state).toBe("open")
    expect(s.view().values.open).toBe(true)
    // Called before the state changes, so `cancel()` can still prevent it.
    expect(calls).toEqual([[true, "OPEN", "closed"]])
  })

  it("defaultOpen sets the initial state", () => {
    const { machine, env } = make()
    expect(createService(machine, { defaultOpen: true }, env).getSnapshot().state).toBe("open")
  })

  it("controlled: the change is a proposal; the state waits for props", () => {
    const { machine, env } = make()
    const onOpenChange = vi.fn()
    const s = createService(machine, { open: false, onOpenChange }, env)
    s.send({ type: "OPEN" })
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: "OPEN" }))
    expect(s.getSnapshot().state).toBe("closed")
    // The transition's actions ran even though the state waits.
    expect(s.getSnapshot().context.count).toBe(1)
  })

  it("controlled: the parent applying the value syncs the state with entries and effects", () => {
    const { machine, env, log } = make()
    const steps: Step[] = []
    const s = createService(machine, { open: false }, env)
    s.inspect((step) => steps.push(step))
    s.start()
    s.send({ type: "OPEN" })
    s.setProps({ open: true })
    expect(s.getSnapshot().state).toBe("open")
    expect(log).toContain("entry:open")
    expect(log).toContain("effect:start")
    expect(steps.at(-1)).toMatchObject({
      event: { type: "$sync" },
      source: "closed",
      target: "open",
    })
  })

  it("controlled: a refused proposal emits $reverted and keeps context", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { open: true }, env)
    s.send({ type: "CLOSE" })
    expect(s.getSnapshot().state).toBe("open")
    s.setProps({ open: true })
    expect(log).toContain("reverted")
    expect(log).not.toContain("exit:open")
    expect(s.getSnapshot().state).toBe("open")
  })

  it("refused proposal keeps context written by the transition's actions", () => {
    const { machine, env } = make()
    const s = createService(machine, { open: false }, env)
    s.send({ type: "OPEN" })
    s.setProps({ open: false })
    expect(s.getSnapshot()).toMatchObject({ state: "closed", context: { count: 1 } })
  })

  it("warns and ignores a later mode switch", () => {
    const { machine, env } = make()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const s = createService(machine, {}, env)
    s.setProps({ open: true })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(s.getSnapshot().state).toBe("closed")
    warn.mockRestore()
  })

  it("cancel() prevents an uncontrolled change and runs nothing", () => {
    const { machine, env } = make()
    const s = createService(machine, { onOpenChange: (_, d) => d.cancel() }, env)
    s.send({ type: "OPEN" })
    expect(s.getSnapshot()).toMatchObject({ state: "closed", context: { count: 0 } })
  })

  it("cancel() in controlled mode is a refusal", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { open: true, onOpenChange: (_, d) => d.cancel() }, env)
    s.send({ type: "CLOSE" })
    expect(log).toEqual(["reverted"])
    expect(s.getSnapshot().state).toBe("open")
  })
})

describe("effects", () => {
  it("read live props, not the ones from when they started", () => {
    const { machine, env } = make()
    const s = createService(machine, { defaultOpen: true, label: "a" }, env)
    s.start()
    s.setProps({ defaultOpen: true, label: "b" })
    expect(env.reads?.()).toBe("b")
  })

  it("onProps sends the declared event when the prop changes", () => {
    const { machine, env } = make()
    const s = createService(machine, { defaultOpen: true, label: "a" }, env)
    s.setProps({ defaultOpen: true, label: "b" })
    expect(s.getSnapshot().context.count).toBe(1)
  })
})

describe("delayed transitions", () => {
  it("fire on fake timers installed after import, and are cancelled on exit", () => {
    vi.useFakeTimers()
    const { machine, env } = make()
    const s = createService(machine, { delay: 500 }, env)
    s.start()
    s.send({ type: "OPEN" })
    vi.advanceTimersByTime(499)
    expect(s.getSnapshot().state).toBe("open")
    vi.advanceTimersByTime(1)
    expect(s.getSnapshot().state).toBe("closed")

    s.send({ type: "OPEN" })
    s.send({ type: "CLOSE" })
    s.send({ type: "OPEN" })
    vi.advanceTimersByTime(499)
    expect(s.getSnapshot().state).toBe("open")
  })

  it("never fire after the state was left early", () => {
    vi.useFakeTimers()
    const { machine, env } = make()
    const s = createService(machine, { delay: 500 }, env)
    s.start()
    s.send({ type: "OPEN" })
    s.send({ type: "CLOSE" })
    const listener = vi.fn()
    s.subscribe(listener)
    vi.advanceTimersByTime(1000)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("lifecycle", () => {
  it("runs in plain Node without DOM globals", () => {
    expect(typeof document).toBe("undefined")
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    s.start()
    s.send({ type: "TOGGLE" })
    s.send({ type: "TOGGLE" })
    s.stop()
    expect(s.getSnapshot().state).toBe("closed")
  })

  it("strict mode remount: effects active once, entry ran once", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { defaultOpen: true }, env)
    s.start()
    s.start()
    s.stop()
    s.stop()
    s.start()
    expect(log.filter((l) => l === "entry:open")).toHaveLength(1)
    const starts = log.filter((l) => l === "effect:start").length
    const stops = log.filter((l) => l === "effect:stop").length
    expect(starts - stops).toBe(1)
  })

  it("server render: snapshot reflects defaultOpen and nothing has run", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { defaultOpen: true }, env)
    expect(s.getSnapshot().state).toBe("open")
    expect(log).toEqual([])
  })

  it("ignores sends from effects after stop", () => {
    let later: (() => void) | undefined
    const m = setup({
      types: type<{ props: object; events: { type: "DONE" }; env: object }>(),
      effects: {
        async: ({ send }) => {
          later = () => send({ type: "DONE" })
          return undefined
        },
      },
    }).machine({
      id: "async",
      initial: "busy",
      states: { busy: { effects: ["async"], on: { DONE: "done" } }, done: {} },
    })
    const s = createService(m, {}, {})
    s.start()
    s.stop()
    later?.()
    expect(s.getSnapshot().state).toBe("busy")
  })

  it("inspect receives event, source, target and actions", () => {
    const { machine, env } = make()
    const s = createService(machine, {}, env)
    const steps: Step[] = []
    s.inspect((step) => steps.push(step))
    s.send({ type: "OPEN" })
    expect(steps).toEqual([
      { event: { type: "OPEN" }, source: "closed", target: "open", actions: ["count", "logEntry"] },
    ])
  })
})

describe("review follow-ups", () => {
  it("controlled proposal: no exit, entry or effects run, and the step is internal", () => {
    const { machine, env, log } = make()
    const steps: Step[] = []
    const s = createService(machine, { open: false }, env)
    s.inspect((step) => steps.push(step))
    s.start()
    s.send({ type: "OPEN" })
    expect(log).toEqual(["service:start"])
    expect(steps).toEqual([
      { event: { type: "OPEN" }, source: "closed", target: null, actions: ["count"] },
    ])
  })

  it("a parent applying the value synchronously gets no spurious $reverted", () => {
    const { machine, env, log } = make()
    let s: ReturnType<typeof createService<typeof machine>> | undefined
    const props = (open: boolean): Props => ({ open, onOpenChange: (v) => s?.setProps(props(v)) })
    s = createService(machine, props(false), env)
    s.send({ type: "OPEN" })
    expect(s.getSnapshot().state).toBe("open")
    expect(s.getSnapshot().proposed).toEqual({})
    s.send({ type: "CLOSE" })
    expect(s.getSnapshot().state).toBe("closed")
    expect(s.getSnapshot().proposed).toEqual({})
    expect(log).not.toContain("reverted")
  })

  it("controlled → uncontrolled is ignored: the last controlled value stays", () => {
    const { machine, env, log } = make()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const s = createService(machine, { open: true }, env)
    s.setProps({})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(s.getSnapshot().state).toBe("open")
    expect(s.view().values.open).toBe(true)
    expect(log).not.toContain("exit:open")
    warn.mockRestore()
  })

  it("setProps after stop() runs nothing; start() re-syncs", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { open: false, label: "a" }, env)
    s.start()
    s.stop()
    s.setProps({ open: true, label: "b" })
    expect(s.getSnapshot()).toMatchObject({ state: "closed", context: { count: 0 } })
    expect(log).not.toContain("entry:open")
    s.start()
    expect(s.getSnapshot().state).toBe("open")
  })

  it("a re-entrant send from an effect is processed in the same outer send", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "GO" } | { type: "DONE" }; env: object }>(),
      effects: {
        finish: ({ send }) => {
          send({ type: "DONE" })
          return undefined
        },
      },
    }).machine({
      id: "fx",
      initial: "a",
      states: { a: { on: { GO: "b" } }, b: { effects: ["finish"], on: { DONE: "c" } }, c: {} },
    })
    const s = createService(m, {}, {})
    const listener = vi.fn()
    s.subscribe(listener)
    s.start()
    s.send({ type: "GO" })
    expect(s.getSnapshot().state).toBe("c")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("a late send from a cleaned effect is dropped", () => {
    const later: (() => void)[] = []
    const m = setup({
      types: type<{ props: object; events: { type: "OPEN" } | { type: "CLOSE" }; env: object }>(),
      effects: {
        deferredClose: ({ send }) => {
          later.push(() => send({ type: "CLOSE" }))
          return undefined
        },
      },
    }).machine({
      id: "late",
      initial: "closed",
      states: {
        closed: { on: { OPEN: "open" } },
        open: { effects: ["deferredClose"], on: { CLOSE: "closed" } },
      },
    })
    const s = createService(m, {}, {})
    s.start()
    s.send({ type: "OPEN" })
    s.send({ type: "CLOSE" })
    s.send({ type: "OPEN" })
    later[0]?.()
    expect(s.getSnapshot().state).toBe("open")
    later[1]?.()
    expect(s.getSnapshot().state).toBe("closed")
  })

  it("root transitions apply when every state guard fails", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "RESET" }; env: object }>(),
      guards: { no: () => false },
    }).machine({
      id: "root",
      initial: "a",
      on: { RESET: "c" },
      states: { a: { on: { RESET: { guard: "no", target: "b" } } }, b: {}, c: {} },
    })
    const s = createService(m, {}, {})
    s.send({ type: "RESET" })
    expect(s.getSnapshot().state).toBe("c")
  })

  it("exit actions read the old value; the change reason can be a delay", () => {
    vi.useFakeTimers()
    const seen: unknown[] = []
    const m = setup({
      types: type<{ props: Props; events: Event; env: SchedulerEnv; values: "open" }>(),
      actions: { exit: ({ values }) => seen.push(`exit sees ${values.open}`) },
      delays: { d: () => 10 },
    }).machine({
      id: "order",
      initial: "closed",
      values: { open: { fallback: false, states: { open: true, closed: false } } },
      states: {
        closed: { on: { OPEN: "open" } },
        open: { exit: ["exit"], after: { d: "closed" } },
      },
    })
    const s = createService(m, { onOpenChange: (_, d) => seen.push(d.reason) }, { scheduler })
    s.start()
    s.send({ type: "OPEN" })
    vi.advanceTimersByTime(10)
    expect(seen).toEqual(["OPEN", "after:d", "exit sees true"])
  })
})

describe("read-only prop bindings", () => {
  type PendingEvent = { type: "PRESS" }
  const spins: string[] = []
  const m = setup({
    types: type<{
      props: { pending?: boolean | undefined }
      events: PendingEvent
      env: object
    }>(),
    effects: {
      spin: () => {
        spins.push("spin")
        return undefined
      },
    },
  }).machine({
    id: "button",
    initial: "idle",
    values: { pending: bindProp({ fallback: false, states: { pending: true, idle: false } }) },
    states: { idle: { on: { PRESS: "pending" } }, pending: { effects: ["spin"] } },
  })

  it("resolves the state from the prop at creation (server render) and runs no effect", () => {
    expect(createService(m, { pending: true }, {}).getSnapshot().state).toBe("pending")
    expect(spins).toEqual([])
  })

  it("follows prop changes through $sync; events cannot leave the bound state", () => {
    const steps: Step[] = []
    const s = createService(m, { pending: false }, {})
    s.inspect((step) => steps.push(step))
    s.send({ type: "PRESS" })
    expect(s.getSnapshot().state).toBe("idle")
    s.setProps({ pending: true })
    expect(s.getSnapshot().state).toBe("pending")
    s.setProps({ pending: false })
    expect(s.getSnapshot().state).toBe("idle")
    expect(steps.map((x) => x.event.type)).toEqual(["$sync", "$sync"])
  })
})

describe("second-pass review", () => {
  it("events cannot leave a state bound to the prop's current value (B1)", () => {
    const steps: Step[] = []
    const changes: unknown[] = []
    const m = setup({
      types: type<{
        props: {
          pending?: boolean | undefined
          open?: boolean | undefined
          defaultOpen?: boolean | undefined
          onOpenChange?: ((v: boolean) => void) | undefined
        }
        events: { type: "FAIL" } | { type: "DONE" }
        env: object
        values: "open"
      }>(),
    }).machine({
      id: "b1",
      initial: "idle",
      values: {
        open: { fallback: false, states: { idle: false, pending: false, error: true } },
        pending: bindProp({
          fallback: false,
          states: { pending: true, idle: false, error: false },
        }),
      },
      states: {
        idle: {},
        pending: { on: { FAIL: "error", DONE: "idle" } },
        error: {},
      },
    })
    const s = createService(m, { pending: true, onOpenChange: (v) => changes.push(v) }, {})
    s.inspect((step) => steps.push(step))
    s.send({ type: "FAIL" })
    s.send({ type: "DONE" })
    expect(s.getSnapshot().state).toBe("pending")
    // Blocked before any side effect: no onOpenChange for the would-be "error" state.
    expect(changes).toEqual([])
    expect(steps).toEqual([])
  })

  it("a send from an effect's own cleanup is dropped (B2)", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "GO" } | { type: "LATE" }; env: object }>(),
      effects: {
        fx:
          ({ send }) =>
          () =>
            send({ type: "LATE" }),
      },
    }).machine({
      id: "b2",
      initial: "a",
      states: { a: { effects: ["fx"], on: { GO: "b" } }, b: { on: { LATE: "c" } }, c: {} },
    })
    const s = createService(m, {}, {})
    s.start()
    s.send({ type: "GO" })
    expect(s.getSnapshot().state).toBe("b")
  })

  it("props changed while stopped are replayed once on start() (B8)", () => {
    const { machine, env, log } = make()
    const s = createService(machine, { open: true, label: "a" }, env)
    s.start()
    s.send({ type: "CLOSE" })
    s.stop()
    // The parent refuses the proposal and changes `label` while the service is stopped.
    s.setProps({ open: true, label: "b" })
    expect(log).not.toContain("reverted")
    s.start()
    expect(log.filter((l) => l === "reverted")).toHaveLength(1)
    // onProps label → PING, handled in `open` by counting.
    expect(s.getSnapshot().context.count).toBe(1)
  })
})
