// Stepper (add-stepper design §2): a controllable, cancellable current step with the linear
// rules (back to any visited step, forward only by Next). The user's moves ask the DOM layer
// to focus the new step's content and announce it once the change lands; the parent's own
// changes (through `step`) do neither.

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import type { StepperMessages, StepStatus } from "./stepper.messages"

export type StepperEvent =
  | { readonly type: "NEXT" }
  | { readonly type: "PREV" }
  | { readonly type: "SELECT"; readonly index: number }
  /** The controlled `step` prop changed (onProps). */
  | { readonly type: "STEP.SYNCED" }

/** Why the step changed, as `onStepChange` reports it. */
export type StepperChangeReason = "next" | "prev" | "select"

/** What `onStepChange` receives: the reason the transition declares, not the event type. */
export interface StepperChangeDetails {
  readonly reason: StepperChangeReason
  readonly event: ChangeDetails<StepperEvent>["event"]
  /** Refuses the change (validation): the step stays. */
  cancel(): void
}

export interface StepperProps {
  readonly id: string
  /** How many steps. */
  readonly count: number
  readonly step?: number | undefined
  readonly defaultStep?: number | undefined
  readonly onStepChange?: ((step: number, details: ChangeDetails<StepperEvent>) => void) | undefined
  /** Back to any visited step; forward only by Next (default true). */
  readonly linear?: boolean | undefined
  /** Steps that cannot be visited (from the mounted Items). */
  readonly disabledSteps?: ReadonlySet<number> | undefined
  /** Steps marked completed by their Items (`false` entries: explicitly not completed). */
  readonly completedSteps?: ReadonlyMap<number, boolean> | undefined
  /** The steps' titles, for the announcement. */
  readonly titles?: ReadonlyMap<number, string> | undefined
  readonly messages: StepperMessages
  readonly lang?: string | undefined
}

/** What the machine reaches the DOM through (injected; absent in Node). */
export interface StepperEnv {
  readonly focusContent?: ((index: number) => void) | undefined
}

export interface StepperContext {
  /** The furthest step reached. */
  readonly visited: number
  /** A user move waiting to land: focus and announce then. */
  readonly pending: number | null
}

type Types = {
  props: StepperProps
  events: StepperEvent
  env: AnnouncerEnv & StepperEnv
  context: StepperContext
  values: "step"
}
type Args = ActionArgs<Types>

const disabled = (props: StepperProps, i: number) => props.disabledSteps?.has(i) === true
const last = (props: StepperProps) => Math.max(0, props.count - 1)

/** The next (or previous) step that is not disabled, or null. */
export function adjacentStep(props: StepperProps, from: number, dir: 1 | -1): number | null {
  for (let i = from + dir; i >= 0 && i <= last(props); i += dir) {
    if (!disabled(props, i)) return i
  }
  return null
}

/** Whether the user can select `index` now (a Trigger is a button iff this holds). */
export function stepReachable(
  props: StepperProps,
  context: StepperContext,
  current: number,
  index: number,
): boolean {
  if (index === current || index < 0 || index > last(props) || disabled(props, index)) {
    return false
  }
  return props.linear === false || index <= context.visited
}

/** completed / current / upcoming. */
export function stepStatus(props: StepperProps, current: number, index: number): StepStatus {
  if (index === current) return "current"
  const own = props.completedSteps?.get(index)
  if (own !== undefined) return own ? "completed" : "upcoming"
  return index < current ? "completed" : "upcoming"
}

function land(args: Args, index: number) {
  const { env, props, set, context } = args
  set("visited", Math.max(context.visited, index))
  env.focusContent?.(index)
  const locale = props.lang ?? "en"
  env.announcer.announce({
    message: props.messages.stepAnnouncement(
      index,
      props.count,
      props.titles?.get(index) ?? "",
      locale,
    ),
    priority: "polite",
    key: `stepper-${props.id}`,
    ...(props.lang === undefined ? {} : { lang: props.lang }),
  })
}

/** Proposes `index`; uncontrolled it lands now, controlled when the prop arrives. */
function move(args: Args, index: number) {
  const { set, props } = args
  set("step", index)
  if (props.step !== undefined) {
    set("pending", index)
    return
  }
  // Refused through details.cancel(): nothing lands.
  if (args.values.step === index) land(args, index)
}

export const stepperMachine = setup({
  types: type<Types>(),
  guards: {
    hasNext: ({ props, values }) => adjacentStep(props, values.step, 1) !== null,
    hasPrev: ({ props, values }) => adjacentStep(props, values.step, -1) !== null,
    canSelect: ({ props, context, values, event }) =>
      event.type === "SELECT" && stepReachable(props, context, values.step, event.index),
  },
  actions: {
    next: (args) => {
      const to = adjacentStep(args.props, args.values.step, 1)
      if (to !== null) move(args, to)
    },
    prev: (args) => {
      const to = adjacentStep(args.props, args.values.step, -1)
      if (to !== null) move(args, to)
    },
    select: (args) => {
      if (args.event.type === "SELECT") move(args, args.event.index)
    },
    synced: (args) => {
      const { context, values, set } = args
      if (context.pending !== null && context.pending === values.step) land(args, values.step)
      else set("visited", Math.max(context.visited, values.step))
      set("pending", null)
    },
  },
}).machine({
  id: "stepper",
  initial: "active",
  context: (props) => {
    const start = props.step ?? props.defaultStep ?? 0
    return { visited: start, pending: null }
  },
  values: { step: { fallback: 0 } },
  onProps: { step: "STEP.SYNCED" },
  states: {
    active: {
      on: {
        NEXT: { guard: "hasNext", actions: ["next"], reason: "next" },
        PREV: { guard: "hasPrev", actions: ["prev"], reason: "prev" },
        SELECT: { guard: "canSelect", actions: ["select"], reason: "select" },
        "STEP.SYNCED": { actions: ["synced"] },
      },
    },
  },
})

export type StepperMachine = typeof stepperMachine
