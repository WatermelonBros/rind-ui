// One case per item of "Definitions Are Type-Checked", so a TypeScript release that
// changes inference shows up here. Every `@ts-expect-error` must keep erroring.
import { describe, expectTypeOf, it } from "vitest"
import type { SchedulerEnv } from "../env"
import { createService } from "./service"
import { bindProp, setup, type } from "./setup"
import type { ChangeDetails, StateOf } from "./types"

type Event = { type: "OPEN" } | { type: "CLOSE" }
interface Props {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: ChangeDetails<Event>) => void
  size?: number
}

const base = setup({
  types: type<{ props: Props; events: Event; env: SchedulerEnv; context: { n: number } }>(),
  actions: { inc: ({ set, context }) => set("n", context.n + 1) },
  guards: { ok: () => true },
  effects: { fx: () => undefined },
  delays: { wait: () => 100 },
})

describe("machine definitions", () => {
  it("infers state names", () => {
    const m = base.machine({
      id: "ok",
      initial: "closed",
      context: () => ({ n: 0 }),
      states: {
        closed: { on: { OPEN: { target: "open", guard: { not: "ok" }, actions: ["inc"] } } },
        open: { effects: ["fx"], after: { wait: "closed" }, on: { CLOSE: "closed" } },
      },
    })
    expectTypeOf<StateOf<typeof m>>().toEqualTypeOf<"open" | "closed">()
  })

  it("rejects a misspelled target", () => {
    base.machine({
      id: "x",
      initial: "closed",
      // @ts-expect-error "opne" is not a state
      states: { closed: { on: { OPEN: "opne" } }, open: {} },
    })
  })

  it("rejects a misspelled initial state", () => {
    // @ts-expect-error "opn" is not a state
    base.machine({ id: "x", initial: "opn", states: { closed: {}, open: {} } })
  })

  it("rejects an event key outside the event union", () => {
    base.machine({
      id: "x",
      initial: "closed",
      // @ts-expect-error OPNE is not an event
      states: { closed: { on: { OPNE: "open" } }, open: {} },
    })
  })

  it("rejects unimplemented actions, guards, effects and delays", () => {
    base.machine({
      id: "x",
      initial: "a",
      states: {
        // @ts-expect-error no action "nope"
        a: { entry: ["nope"] },
        // @ts-expect-error no guard "nope"
        b: { on: { OPEN: { target: "a", guard: "nope" } } },
        // @ts-expect-error no effect "nope"
        c: { effects: ["nope"] },
        // @ts-expect-error no delay "nope"
        d: { after: { nope: "a" } },
      },
    })
  })

  it("rejects a dotted state name", () => {
    // @ts-expect-error "." is reserved
    base.machine({ id: "x", initial: "a.b", states: { "a.b": {} } })
  })

  it("rejects delays when the environment has no scheduler", () => {
    setup({
      types: type<{ props: object; events: Event; env: object }>(),
      // @ts-expect-error delays need SchedulerEnv
      delays: { wait: () => 1 },
    })
  })
})

describe("controllables", () => {
  const ctl = setup({
    types: type<{ props: Props; events: Event; env: object; values: "open" }>(),
    actions: {
      write: ({ set }) => set("open", true),
      // @ts-expect-error "size" is not a declared controllable
      bad: ({ set }) => set("size", 1),
    },
  })

  it("requires the state binding to cover every state", () => {
    ctl.machine({
      id: "x",
      initial: "closed",
      // @ts-expect-error "open" is missing from states
      values: { open: { fallback: false, states: { closed: false } } },
      states: { closed: {}, open: {} },
    })
  })

  it("requires declared controllables in `values`", () => {
    // @ts-expect-error `values.open` is missing
    ctl.machine({ id: "x", initial: "closed", states: { closed: {}, open: {} } })
  })

  it("rejects a controllable whose props break the convention", () => {
    const bad = setup({
      types: type<{ props: Props; events: Event; env: object; values: "size" }>(),
    })
    bad.machine({
      id: "x",
      initial: "a",
      // @ts-expect-error `size` has no defaultSize / onSizeChange
      values: { size: { fallback: 0 } },
      states: { a: {} },
    })
  })

  it("types the service from the machine", () => {
    const m = ctl.machine({
      id: "x",
      initial: "closed",
      values: { open: { fallback: false, states: { closed: false, open: true } } },
      states: { closed: { on: { OPEN: "open" } }, open: {} },
    })
    const s = createService(m, {}, {})
    expectTypeOf(s.view().values.open).toEqualTypeOf<boolean>()
    expectTypeOf(s.getSnapshot().state).toEqualTypeOf<"closed" | "open">()
    // @ts-expect-error not an event
    s.send({ type: "NOPE" })
  })
})

describe("review type holes", () => {
  type PayloadEvent = { type: "OPEN"; trigger: string } | { type: "CLOSE" }
  interface P2 {
    label?: string
  }
  const withContext = setup({
    types: type<{ props: P2; events: PayloadEvent; env: object; context: { n: number } }>(),
  })

  it("requires a context factory when context is declared", () => {
    // @ts-expect-error context declared, no factory
    withContext.machine({ id: "h1", initial: "a", states: { a: {} } })
  })

  it("onProps only sends events that need no payload", () => {
    withContext.machine({
      id: "h2",
      initial: "a",
      context: () => ({ n: 0 }),
      // @ts-expect-error OPEN requires `trigger`
      onProps: { label: "OPEN" },
      states: { a: {} },
    })
  })

  it("details.reason includes runtime events", () => {
    // @ts-expect-error reason may be "after:…", "$start", "$sync" or "$reverted"
    const r: (d: ChangeDetails<PayloadEvent>) => "OPEN" | "CLOSE" = (d) => d.reason
    void r
  })

  it("controllables are checked by type, not only by name", () => {
    interface BadProps {
      open?: boolean
      defaultOpen?: string
      onOpenChange?: string
    }
    const bad = setup({
      types: type<{ props: BadProps; events: PayloadEvent; env: object; values: "open" }>(),
    })
    bad.machine({
      id: "h4",
      initial: "a",
      // @ts-expect-error defaultOpen and onOpenChange have the wrong types
      values: { open: { fallback: false, states: { a: true } } },
      states: { a: {} },
    })
  })

  it("bindProp names are checked against props", () => {
    const b = setup({
      types: type<{ props: { pending?: boolean }; events: PayloadEvent; env: object }>(),
    })
    b.machine({
      id: "b",
      initial: "idle",
      values: {
        // @ts-expect-error no prop "pendng"
        pendng: bindProp({ fallback: false, states: { idle: false, busy: true } }),
      },
      states: { idle: {}, busy: {} },
    })
  })
})
