// Steps are data (design §1): types, defaults and the index arithmetic the machine, connect
// and the adapter share. Pure; no DOM.

import type { WaitForElementOptions, WaitForEventOptions } from "../../dom/wait-for-element"
import type { Align, LogicalSide } from "../../env/position"

export type TourStepType = "tooltip" | "dialog" | "wait"
export type TourMissingTarget = "skip" | "stop" | "center"
export type TourCloseReason =
  | "complete"
  | "skip"
  | "dismiss"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "target-missing"
  | "steps-changed"
  | "api"
export type TourDirection = "forward" | "backward" | "jump"
export type TourPhase = "idle" | "preparing" | "shown" | "waiting"

/** What a custom action receives. */
export interface TourActionApi {
  next(): void
  prev(): void
  dismiss(): void
  skip(): void
  goto(id: string): void
}

export type TourActionKind = "next" | "prev" | "dismiss" | "skip"

export interface TourAction<C = unknown> {
  /** Visible content; without it the trigger is named by `messages`. */
  readonly label?: C
  readonly action: TourActionKind | ((api: TourActionApi) => void)
  /** Extra attributes for the ActionTrigger. */
  readonly attrs?: Readonly<Record<string, unknown>>
}

/** What a step's `effect` receives. */
export interface TourStepEffectArgs<C = unknown> {
  /** Shows the step now (the effect may keep running). */
  show(): void
  /** Replaces fields of the step, also once it is shown. */
  update(patch: TourStepPatch<C>): void
  next(): void
  goto(id: string): void
  dismiss(): void
  /** Aborted when the step is left by any path. */
  readonly signal: AbortSignal
  /** The resolved target (null for a step without one). */
  readonly target: Element | null
  /** `waitForElement` bound to `signal` and the tour's root. */
  waitForElement<T extends Element>(
    resolver: () => T | null | undefined,
    options?: Omit<WaitForElementOptions, "signal" | "root">,
  ): Promise<T>
  /** `waitForEvent` bound to `signal`. */
  waitForEvent<E extends Event = Event>(
    target: EventTarget | null | undefined,
    type: string,
    options?: Omit<WaitForEventOptions<E>, "signal">,
  ): Promise<E>
}

export type TourStepCleanup = () => void
export type TourStepEffect<C = unknown> = (
  args: TourStepEffectArgs<C>,
  // biome-ignore lint/suspicious/noConfusingVoidType: a plain or async effect may return nothing
) => TourStepCleanup | undefined | void | Promise<TourStepCleanup | undefined | void>

export interface TourStep<C = unknown> {
  readonly id: string
  readonly title?: C
  readonly description?: C
  /** The element the step points at, re-read on every positioning pass. */
  readonly target?: (() => Element | null | undefined) | undefined
  /** Default: `tooltip` with a target, `dialog` without. */
  readonly type?: TourStepType | undefined
  readonly side?: LogicalSide | undefined
  readonly align?: Align | undefined
  readonly sideOffset?: number | undefined
  readonly alignOffset?: number | undefined
  /** The card may cover its target instead of leaving the viewport. */
  readonly sticky?: boolean | undefined
  /** Default true. */
  readonly backdrop?: boolean | undefined
  /** Default true (anchored steps only). */
  readonly arrow?: boolean | undefined
  /** Default: true for a centred step, false for an anchored one. */
  readonly modal?: boolean | undefined
  /** `scrollIntoView` options; `false` does not scroll. */
  readonly scroll?: ScrollIntoViewOptions | false | undefined
  /** Positioning tracking every frame (a target animated by script). */
  readonly tracking?: "auto" | "frame" | undefined
  /** Milliseconds to wait for the target and the effect (default `prepareTimeout`). */
  readonly timeout?: number | undefined
  /** Default `skip`. */
  readonly missingTarget?: TourMissingTarget | undefined
  readonly preventTargetInteraction?: boolean | undefined
  readonly actions?: readonly TourAction<C>[] | undefined
  readonly effect?: TourStepEffect<C> | undefined
}

export type TourStepPatch<C = unknown> = Partial<Omit<TourStep<C>, "id">>

/** A step's resolved type. */
export const stepType = (step: Pick<TourStep, "type" | "target">): TourStepType =>
  step.type ?? (step.target ? "tooltip" : "dialog")

/** An anchored step: it has a target and is not a centred dialog. */
export const isAnchored = (step: Pick<TourStep, "type" | "target">) =>
  stepType(step) === "tooltip" && step.target !== undefined

/** Throws a configuration error naming the first duplicated id. */
export function validateSteps(steps: readonly Pick<TourStep, "id">[]): void {
  const seen = new Set<string>()
  for (const { id } of steps) {
    if (seen.has(id)) throw new Error(`[rind-ui] tour: two steps share the id "${id}"`)
    seen.add(id)
  }
}

export const indexOf = (steps: readonly Pick<TourStep, "id">[], id: string | null | undefined) =>
  id ? steps.findIndex((s) => s.id === id) : -1

/** The next step's index, or -1. */
export const nextIndex = (steps: readonly TourStep[], from: number) =>
  from + 1 < steps.length ? from + 1 : -1

/** The previous step that is not a wait step, or -1 (Back skips wait steps). */
export function prevIndex(steps: readonly TourStep[], from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    const s = steps[i]
    if (s && stepType(s) !== "wait") return i
  }
  return -1
}

/** Progress over the steps that are not wait steps: 1-based `current`, `total`, 0–1. */
export function progressOf(steps: readonly TourStep[], id: string | null | undefined) {
  const visible = steps.filter((s) => stepType(s) !== "wait")
  const total = visible.length
  const at = visible.findIndex((s) => s.id === id)
  const current = at < 0 ? 0 : at + 1
  return { current, total, progress: total === 0 ? 0 : current / total }
}
