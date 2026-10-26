// Tour (design §1): four flat states, steps are data. `preparing` resolves the target and runs
// the step's effect (the visit, handed off to the state that shows the step); `active` shows a
// card — one layer per shown step, modal or not — and `waiting` shows nothing until the wait
// step's effect moves on. The close events are named after the close reasons, so
// `onOpenChange`'s `details.reason` is the reason itself; the other reasons are declared on
// their transitions.

import type { Modality } from "../../contract/env"
import { cssZoom } from "../../dom/css-zoom"
import type { DismissRequest } from "../../dom/dismiss"
import { focusSafely } from "../../dom/focus-safely"
import {
  containsDeep,
  deepActiveElement,
  type FocusTarget,
  focusInitial,
  stopsOf,
} from "../../dom/focus-scope"
import { getLayerStack, type LayerId, layerId } from "../../dom/layer-stack"
import { trackNonModalTabOrder } from "../../dom/non-modal-tab-order"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import { createStepVisit, type StepVisit } from "../../dom/step-effect"
import { isRendered, waitForElement, waitForEvent } from "../../dom/wait-for-element"
import type { BaseDomEnvironment } from "../../env/base-environment"
import type { AnnouncerEnv } from "../../env/capabilities"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  RectLike,
  Side,
} from "../../env/position"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { cutoutsFor, spotlightPath } from "./spotlight-path"
import type { TourMessages } from "./tour.messages"
import {
  indexOf,
  isAnchored,
  nextIndex,
  prevIndex,
  progressOf,
  stepType,
  type TourCloseReason,
  type TourDirection,
  type TourMissingTarget,
  type TourStep,
  type TourStepEffectArgs,
  type TourStepPatch,
  validateSteps,
} from "./tour.steps"

declare const process: { env: { NODE_ENV?: string } }

type Dismissal<K extends string> = { readonly type: K; readonly request?: DismissRequest }

export type TourEvent =
  | { readonly type: "START"; readonly stepId?: string | undefined; readonly modality?: Modality }
  /** `effect`: sent by a step effect's `next()` (allowed while preparing). */
  | { readonly type: "STEP.NEXT"; readonly effect?: boolean }
  | { readonly type: "STEP.PREV" }
  | { readonly type: "STEP.GOTO"; readonly id: string }
  /** The shown step's visit ended without leaving it (Strict Mode): prepare it again. */
  | { readonly type: "STEP.RESUME" }
  | { readonly type: "STEP.READY"; readonly visit: StepVisit }
  | {
      readonly type: "STEP.MISSING"
      readonly why: "timeout" | "effect-error"
      readonly visit: StepVisit
    }
  | { readonly type: "STEP.UPDATE"; readonly id: string; readonly patch: TourStepPatch }
  | { readonly type: "STEPS.SET" }
  /** The controlled `stepId` changed to a step the tour did not propose. */
  | { readonly type: "STEP.SYNCED" }
  | { readonly type: "TARGET.LOST" }
  /** `close`: the close trigger (always `dismiss`, also on the last step). */
  | (Dismissal<"dismiss"> & { readonly close?: true })
  | Dismissal<"skip">
  | Dismissal<"escape-key">
  | Dismissal<"outside-press">
  | Dismissal<"outside-focus">
  | { readonly type: "api" }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }
  | { readonly type: "POSITION.REPOSITION" }
  /** The spotlight's step-change transition ended, or a scroll or resize came after it. */
  | { readonly type: "SPOTLIGHT.SETTLED" }

/** Spotlight geometry options (tour-wide). */
export interface TourSpotlightOptions {
  /** Default 8 (px); a number or `{ x, y }`. */
  readonly padding?: number | { readonly x: number; readonly y: number } | undefined
  /** Default 8 (px), clamped to half the cutout's shorter side. */
  readonly radius?: number | undefined
  /** Also cut out the card (default off); `true` = padding 6, radius 12. */
  readonly content?:
    | boolean
    | { readonly padding?: number | undefined; readonly radius?: number | undefined }
    | undefined
}

export interface TourProps {
  readonly steps: readonly TourStep[]
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<TourEvent>) => void) | undefined
  /** The shown step's id (`""`: none). */
  readonly stepId?: string | undefined
  readonly defaultStepId?: string | undefined
  /**
   * The step a run starts at. Adapters pass the consumer's `defaultStepId` here and not as
   * `defaultStepId`, so the first shown step of a run is always reported to `onStepChange`.
   */
  readonly firstStepId?: string | undefined
  /** The runtime's name for the step change callback (the adapter maps `onStepChange`). */
  readonly onStepIdChange?:
    | ((stepId: string, details: ChangeDetails<TourEvent>) => void)
    | undefined
  /** Every step modal (a step's own `modal` wins). */
  readonly modal?: boolean | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** Default false: a stray click does not end the tour. */
  readonly closeOnOutsidePress?: boolean | undefined
  /** Default false. */
  readonly closeOnOutsideFocus?: boolean | undefined
  /** Arrow keys inside the card move between steps (default true). */
  readonly keyboardNavigation?: boolean | undefined
  /** Milliseconds a step's target and effect may take (default 5000). */
  readonly prepareTimeout?: number | undefined
  readonly preventTargetInteraction?: boolean | undefined
  readonly spotlight?: TourSpotlightOptions | undefined
  /** The first focus on start (default: the content); `false` does not move focus. */
  readonly initialFocus?: (() => FocusTarget) | null | undefined
  /** Where focus returns when the tour ends; `false`: it does not move. */
  readonly finalFocus?: ((reason: TourCloseReason | null) => FocusTarget) | false | null | undefined
  readonly onMissingTarget?:
    | ((details: { readonly stepId: string; readonly policy: TourMissingTarget }) => void)
    | undefined
  /** Elements whose presses and focus count as inside (a toast). */
  readonly persistentElements?: (() => readonly Element[]) | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The nearest layer this one was opened from (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  readonly messages: TourMessages
}

export interface TourContext {
  /** The step being prepared (or shown, until the next navigation). */
  readonly pendingId: string | null
  readonly direction: TourDirection
  /** The adopted visit of the shown step. */
  readonly visit: StepVisit | null
  /** `preparing` re-entered for the same step (target lost): the visit stays alive. */
  readonly keepVisit: boolean
  /** The shown step is a missing target shown centred (`center` policy). */
  readonly targetMissing: boolean
  readonly placement: PlacementState
  /** The last close reason, until the next start (`data-close-reason`). */
  readonly closeReason: TourCloseReason | null
  /** `update(patch)` of the steps, by id. */
  readonly patches: Readonly<Record<string, TourStepPatch>>
  /** A step was shown since the start: later steps do not take the first focus. */
  readonly shownOnce: boolean
  /** Focus was inside the card when the step changed. */
  readonly focusWasInside: boolean
  /** Focus when the tour started: where it returns. */
  readonly startFocus: Element | null
  /** The tour ran since it was created (idle's entry restores focus only after a run). */
  readonly ran: boolean
  /**
   * The shown step replaced another one of the same run: the spotlight may animate
   * (`data-step-changing`) until its transition ends or a later scroll or resize settles it.
   */
  readonly stepChanging: boolean
}

export const tourIds = (root: string) => ({
  trigger: partId("tour", root, "trigger"),
  backdrop: partId("tour", root, "backdrop"),
  spotlight: partId("tour", root, "spotlight"),
  positioner: partId("tour", root, "positioner"),
  content: partId("tour", root, "content"),
  arrow: partId("tour", root, "arrow"),
  title: partId("tour", root, "title"),
  description: partId("tour", root, "description"),
})

export const tourLayerId = (root: string) => layerId(`tour-${root}`)

/**
 * The live `send` of the state that holds each visit: an effect's callbacks (`next()`,
 * `update()`…) outlive `preparing`, whose own `send` is dropped once it exits.
 */
const channels = new WeakMap<StepVisit, (event: TourEvent) => void>()

/** A step with its `update()` patches applied. */
export function resolveStep(
  props: Pick<TourProps, "steps">,
  patches: TourContext["patches"],
  id: string | null | undefined,
): TourStep | undefined {
  const step = id ? props.steps.find((s) => s.id === id) : undefined
  if (!step) return undefined
  const patch = patches[step.id]
  return patch ? { ...step, ...patch, id: step.id } : step
}

/** The step a run starts at: the requested one, else `defaultStepId`, else the first. */
const startId = (props: TourProps, requested: string | null | undefined) =>
  (requested && indexOf(props.steps, requested) >= 0 ? requested : undefined) ??
  [props.firstStepId, props.defaultStepId].find(
    (id): id is string => !!id && indexOf(props.steps, id) >= 0,
  ) ??
  props.steps[0]?.id ??
  null

/** The step the machine is on: the pending one while preparing, else the shown one. */
const currentId = (state: string, context: TourContext, shown: string) =>
  state === "preparing" ? context.pendingId : shown || context.pendingId

/** A step's own `modal`, else modal when the tour forces it, else modal when centred. */
export const isStepModal = (props: Pick<TourProps, "modal">, step: TourStep, centered: boolean) =>
  step.modal ?? (props.modal === true || centered || !isAnchored(step))

/** The anchored step's positioning (design: popup preset, 12 px gap, shift and flip). */
export function stepPositioning(step: TourStep): PositioningOptions {
  const own = {
    side: step.side,
    align: step.align,
    sideOffset: step.sideOffset,
    alignOffset: step.alignOffset,
    sticky: step.sticky,
    tracking: step.tracking,
  }
  // Sound: resolvePositioning drops the undefined entries; the rest are PositioningProps.
  return resolvePositioning(own as PositioningProps, {
    ...positioningPresets.popup,
    sideOffset: 12,
    collisionPadding: 8,
    // Sticky: keep the side and shift onto the target rather than flip out of the viewport.
    collisionAvoidance: step.sticky
      ? { side: "shift", align: "shift", fallbackAxis: "none" }
      : { side: "flip", align: "shift", fallbackAxis: "end" },
  })
}

const spotlightPadding = (o: TourSpotlightOptions | undefined) => {
  const p = o?.padding ?? 8
  return typeof p === "number" ? { x: p, y: p } : p
}

const contentCutout = (o: TourSpotlightOptions | undefined) => {
  const c = o?.content
  if (!c) return false as const
  return {
    padding: (typeof c === "object" ? c.padding : undefined) ?? 6,
    radius: (typeof c === "object" ? c.radius : undefined) ?? 12,
  }
}

const isPromise = (v: unknown): v is PromiseLike<unknown> =>
  typeof v === "object" && v !== null && typeof (v as { then?: unknown }).then === "function"

const rectOf = (r: DOMRect | RectLike) => ({ x: r.x, y: r.y, width: r.width, height: r.height })

const documentOf = (env: BaseDomEnvironment) => {
  const root = env.dom.getRootNode()
  return "body" in root ? root : root.ownerDocument
}

/** The document, or null where there is none (Node, a model test's oracle environment). */
const documentOrNull = (env: BaseDomEnvironment): Document | null => {
  if (typeof document === "undefined") return null
  const root = env.dom?.getRootNode?.()
  if (!root || typeof root !== "object") return null
  return "body" in root ? root : (root.ownerDocument ?? null)
}

/** The element the non-modal Tab order treats as the target: the last tab stop it holds. */
function tabStopFor(env: BaseDomEnvironment, target: Element | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  const inner = stopsOf(env, target)
  return inner.at(-1) ?? (target.tabIndex >= 0 ? target : null)
}

export const tourMachine = /* @__PURE__ */ setup({
  types: type<{
    props: TourProps
    events: TourEvent
    env: BaseDomEnvironment & AnnouncerEnv & PositionEnv
    context: TourContext
    values: "open" | "stepId"
  }>(),
  guards: {
    isWaitStep: ({ props, context, event }) =>
      event.type === "STEP.READY" &&
      stepType(resolveStep(props, context.patches, event.visit.stepId) ?? { type: "dialog" }) ===
        "wait",
    hasNext: ({ props, context, values }) => {
      const at = indexOf(props.steps, currentId("active", context, values.stepId))
      return at >= 0 && nextIndex(props.steps, at) >= 0
    },
    hasPrev: ({ props, context, values }) => {
      const at = indexOf(props.steps, currentId("active", context, values.stepId))
      return at >= 0 && prevIndex(props.steps, at) >= 0
    },
    /** An effect's `next()` while its own step is prepared: a step after it exists. */
    effectHasNext: ({ props, context, event }) => {
      if (event.type !== "STEP.NEXT" || !event.effect) return false
      const at = indexOf(props.steps, context.pendingId)
      return at >= 0 && nextIndex(props.steps, at) >= 0
    },
    fromEffect: ({ event }) => event.type === "STEP.NEXT" && event.effect === true,
    knownStep: ({ props, event }) => {
      if (event.type !== "STEP.GOTO") return false
      if (indexOf(props.steps, event.id) >= 0) return true
      if (process.env.NODE_ENV !== "production") {
        console.error(`[rind-ui] tour: goto("${event.id}"): no step has this id`)
      }
      return false
    },
    /** A dismiss action (not the close trigger) on the last step completes the tour. */
    isLastShown: ({ props, values, event }) => {
      if (event.type === "dismiss" && event.close) return false
      const at = indexOf(props.steps, values.stepId)
      return at >= 0 && at === props.steps.length - 1
    },
    closesOnEscape: ({ props }) => props.closeOnEscape !== false,
    closesOnOutsidePress: ({ props }) => props.closeOnOutsidePress === true,
    closesOnOutsideFocus: ({ props }) => props.closeOnOutsideFocus === true,
    pendingGone: ({ props, context }) =>
      context.pendingId !== null && indexOf(props.steps, context.pendingId) < 0,
    shownGone: ({ props, values }) =>
      values.stepId !== "" && indexOf(props.steps, values.stepId) < 0,
    /** The controlled `stepId` names a step other than the shown and the pending one. */
    syncedElsewhere: ({ props, context, values }) =>
      props.stepId !== undefined &&
      props.stepId !== context.pendingId &&
      indexOf(props.steps, props.stepId) >= 0 &&
      values.stepId === props.stepId,
    policyCenter: ({ props, context }) =>
      resolveStep(props, context.patches, context.pendingId)?.missingTarget === "center",
    policyStop: ({ props, context }) =>
      resolveStep(props, context.patches, context.pendingId)?.missingTarget === "stop",
    /** Skipping in the direction of travel finds a step. */
    skipFinds: ({ props, context }) => {
      const at = indexOf(props.steps, context.pendingId)
      const steps = props.steps
      return context.direction === "backward"
        ? prevIndex(steps, at) >= 0
        : nextIndex(steps, at) >= 0
    },
    skipForward: ({ context }) => context.direction !== "backward",
  },
  actions: {
    /** Leaving idle by any path (START, a controlled `open`, `defaultOpen`): a fresh run. */
    beginRun: ({ env, props, values, set }) => {
      // A run opened without START (defaultOpen, a controlled `open`) starts here.
      set("pendingId", startId(props, values.stepId || undefined))
      set("direction", "forward")
      set("closeReason", null)
      set("shownOnce", false)
      set("ran", true)
      set("stepChanging", false)
      set("patches", {})
      set("visit", null)
      set("keepVisit", false)
      set("targetMissing", false)
      const doc = documentOrNull(env)
      set("startFocus", doc ? deepActiveElement(doc) : null)
    },
    recordStart: ({ props, event, set }) => {
      if (event.type !== "START") return
      set("pendingId", startId(props, event.stepId))
      set("direction", event.stepId ? "jump" : "forward")
    },
    /** Before navigating: was focus inside the card (the node may be gone at placement). */
    noteFocus: ({ env, props, set }) => {
      const doc = documentOrNull(env)
      if (!doc) return
      const content = env.dom.getById(tourIds(props.root).content)
      const active = deepActiveElement(doc)
      set("focusWasInside", !!content && !!active && containsDeep(content, active))
    },
    setPendingNext: ({ props, context, values, set }) => {
      const at = indexOf(props.steps, currentId("active", context, values.stepId))
      set("pendingId", props.steps[nextIndex(props.steps, at)]?.id ?? null)
      set("direction", "forward")
    },
    setPendingNextOfPending: ({ props, context, set }) => {
      const at = indexOf(props.steps, context.pendingId)
      set("pendingId", props.steps[nextIndex(props.steps, at)]?.id ?? null)
      set("direction", "forward")
    },
    setPendingPrev: ({ props, context, values, set }) => {
      const at = indexOf(props.steps, currentId("active", context, values.stepId))
      set("pendingId", props.steps[prevIndex(props.steps, at)]?.id ?? null)
      set("direction", "backward")
    },
    setPendingGoto: ({ event, set }) => {
      if (event.type !== "STEP.GOTO") return
      set("pendingId", event.id)
      set("direction", "jump")
    },
    setPendingSynced: ({ props, set }) => {
      set("pendingId", props.stepId ?? null)
      set("direction", "jump")
    },
    setPendingSame: ({ context, values, set }) => {
      set("pendingId", values.stepId || context.pendingId)
    },
    setPendingSkip: ({ props, context, set }) => {
      const at = indexOf(props.steps, context.pendingId)
      const steps = props.steps
      const to = context.direction === "backward" ? prevIndex(steps, at) : nextIndex(steps, at)
      set("pendingId", steps[to]?.id ?? null)
    },
    /** Exit of a shown state: target lost keeps the visit for the same step. */
    noteKeep: ({ event, set }) => set("keepVisit", event.type === "TARGET.LOST"),
    /**
     * Preparing's exit, before its effect's cleanup: a visit about to be shown is handed
     * off, so the cleanup leaves it alive (a missing step is shown only with `center`).
     */
    handOff: ({ event, props, context }) => {
      if (event.type === "STEP.READY") event.visit.handedOff = true
      else if (
        event.type === "STEP.MISSING" &&
        resolveStep(props, context.patches, context.pendingId)?.missingTarget === "center"
      ) {
        event.visit.handedOff = true
      }
    },
    adoptVisit: ({ event, context, set }) => {
      if (event.type !== "STEP.READY" && event.type !== "STEP.MISSING") return
      set("visit", event.visit)
      set("keepVisit", false)
      set("targetMissing", event.type === "STEP.MISSING")
      // Not on a run's first step: there is nothing to animate from.
      set("stepChanging", context.shownOnce)
      set("stepId", event.visit.stepId)
    },
    reportMissing: ({ props, context }) => {
      const step = resolveStep(props, context.patches, context.pendingId)
      if (!step) return
      props.onMissingTarget?.({ stepId: step.id, policy: step.missingTarget ?? "skip" })
    },
    enterShown: ({ props, context, values, set }) => {
      const step = resolveStep(props, context.patches, values.stepId)
      const anchored = !!step && isAnchored(step) && !context.targetMissing
      const o = step && anchored ? stepPositioning(step) : undefined
      const side = o
        ? o.side === "inline-start"
          ? "left"
          : o.side === "inline-end"
            ? "right"
            : o.side
        : "bottom"
      // A centred step is placed by CSS at once; an anchored one waits for positioning.
      set(
        "placement",
        anchored
          ? unplaced(side, o?.align ?? "center")
          : placementFrom({ side, align: "center", anchorHidden: false }),
      )
    },
    setPlacement: ({ event, set }) => {
      if (event.type !== "POSITION.PLACED") return
      set("placement", placementFrom(event))
      if (event.first) set("shownOnce", true)
    },
    reposition: ({ env, props }) => env.position.reposition(tourIds(props.root).positioner),
    settleSpotlight: ({ set }) => set("stepChanging", false),
    applyPatch: ({ event, context, set }) => {
      if (event.type !== "STEP.UPDATE") return
      set("patches", {
        ...context.patches,
        [event.id]: { ...context.patches[event.id], ...event.patch },
      })
    },
    validate: ({ props }) => {
      try {
        validateSteps(props.steps)
      } catch (error) {
        console.error(error)
      }
    },
    closeComplete: ({ set }) => set("closeReason", "complete"),
    closeTargetMissing: ({ set }) => set("closeReason", "target-missing"),
    closeStepsChanged: ({ set }) => set("closeReason", "steps-changed"),
    closeFromEvent: ({ event, set }) => {
      const t = event.type
      if (
        t === "dismiss" ||
        t === "skip" ||
        t === "escape-key" ||
        t === "outside-press" ||
        t === "outside-focus" ||
        t === "api"
      ) {
        set("closeReason", t)
      }
    },
    /** Idle's entry after a run: focus back to where the tour started (design §6). */
    restoreFocus: ({ env, props, context }) => {
      const doc = documentOrNull(env)
      if (!context.ran || !doc) return
      const ids = tourIds(props.root)
      const active = deepActiveElement(doc)
      const content = env.dom.getById(ids.content)
      const inTour = !!active && !!content && containsDeep(content, active)
      // The user moved on (a field outside the tour): leave focus there.
      if (active && active !== doc.body && !inTour) return
      if (props.finalFocus === false) return
      const chosen = props.finalFocus?.(context.closeReason) ?? null
      if (chosen === false) return
      // Focus was on nothing at start (a virtual click): the trigger.
      const started = context.startFocus === doc.body ? null : context.startFocus
      const fallback = started ?? env.dom.getById(ids.trigger)
      const target =
        chosen ?? (fallback instanceof HTMLElement && fallback.isConnected ? fallback : null)
      if (target) void focusSafely(target, env, "programmatic")
    },
  },
  effects: {
    /**
     * The visit (design §2): resolve the target, run the step's effect, race both with the
     * timeout; hand the visit to the state that shows the step.
     */
    visit: (a) => {
      const { env, props, send } = a
      const context = a.context
      const id = context.pendingId ?? startId(props, a.values.stepId || undefined)
      const step = resolveStep(props, context.patches, id)
      if (!id || !step) {
        if (!props.steps.length) send({ type: "api" })
        return undefined
      }
      const kept = context.visit
      const reused = kept && !kept.released && kept.stepId === id && context.keepVisit ? kept : null
      const visit = reused ?? createStepVisit(id)
      visit.handedOff = false
      channels.set(visit, send)
      const dispatch = (e: TourEvent) => {
        if (!visit.released) channels.get(visit)?.(e)
      }
      const local = new AbortController()
      const onVisitAbort = () => local.abort()
      visit.signal.addEventListener("abort", onVisitAbort, { once: true })
      let settled = false
      let navigated = false
      const finish = () => {
        settled = true
        env.scheduler.clearTimeout(timer)
      }
      const ready = () => {
        if (settled || visit.released) return
        finish()
        send({ type: "STEP.READY", visit })
      }
      const missing = (why: "timeout" | "effect-error") => {
        if (settled || visit.released) return
        finish()
        send({ type: "STEP.MISSING", why, visit })
      }
      const timer = env.scheduler.setTimeout(
        () => missing("timeout"),
        step.timeout ?? props.prepareTimeout ?? 5000,
      )
      const type = stepType(step)
      const root = typeof document === "undefined" ? undefined : env.dom.getRootNode()
      const run = (target: Element | null) => {
        if (settled || visit.released) return
        if (reused || !step.effect) return ready()
        const args: TourStepEffectArgs = {
          show: ready,
          update: (patch) => dispatch({ type: "STEP.UPDATE", id, patch }),
          next: () => {
            navigated = true
            dispatch({ type: "STEP.NEXT", effect: true })
          },
          goto: (to) => {
            navigated = true
            dispatch({ type: "STEP.GOTO", id: to })
          },
          dismiss: () => {
            navigated = true
            dispatch({ type: "dismiss" })
          },
          signal: visit.signal,
          target,
          waitForElement: (resolver, o) =>
            waitForElement(resolver, {
              ...o,
              root,
              signal: visit.signal,
              scheduler: env.scheduler,
            }),
          waitForEvent: (t, eventType, o) =>
            waitForEvent(t, eventType, { ...o, signal: visit.signal }),
        }
        let result: unknown
        try {
          result = step.effect(args)
        } catch (error) {
          console.error(`[rind-ui] tour: the effect of step "${id}" threw`, error)
          return missing("effect-error")
        }
        visit.setResult(result)
        // A wait step shows nothing: its effect moves the tour on.
        if (type === "wait") return ready()
        if (isPromise(result)) {
          result.then(
            () => {
              if (!navigated) ready()
            },
            (error: unknown) => {
              console.error(`[rind-ui] tour: the effect of step "${id}" rejected`, error)
              missing("effect-error")
            },
          )
          return
        }
        if (!navigated) ready()
      }
      const getTarget = step.target
      if (type === "dialog" || !getTarget) run(null)
      else {
        const el = getTarget() ?? null
        if (isRendered(el)) run(el)
        else if (root) {
          waitForElement(() => getTarget() ?? null, { root, signal: local.signal }).then(
            run,
            () => {},
          )
        }
      }
      return () => {
        env.scheduler.clearTimeout(timer)
        visit.signal.removeEventListener("abort", onVisitAbort)
        local.abort()
        if (!visit.handedOff) visit.release()
      }
    },
    /** Holds the shown step's visit: released when the step is left (not on a lost target). */
    holdVisit: (a) => {
      const visit = a.context.visit
      if (!visit || visit.released) {
        // The service was stopped and started again (Strict Mode): prepare the step anew.
        a.send({ type: "STEP.RESUME" })
        return undefined
      }
      channels.set(visit, a.send)
      return () => {
        if (!a.context.keepVisit) visit.release()
      }
    },
    /** One layer per shown step (design §5); focus restore is idle's entry. */
    overlay: (a) => {
      const { env, props, send } = a
      if (typeof document === "undefined") return undefined
      const ids = tourIds(props.root)
      const step = resolveStep(props, a.context.patches, a.values.stepId)
      if (!step) return undefined
      const centered = a.context.targetMissing || !isAnchored(step)
      const modal = isStepModal(props, step, centered)
      const byId = (id: string) => env.dom.getById(id)
      const target = () => (centered ? null : (step.target?.() ?? null))
      let closed = false
      const id = tourLayerId(props.root)
      const stop = overlayEffect(env, {
        id,
        kind: "tour",
        modal,
        parent: props.parent,
        opener: () => byId(ids.trigger),
        elements: () =>
          [byId(ids.positioner), byId(ids.content), byId(ids.spotlight), target()].filter(
            (e): e is HTMLElement => e instanceof HTMLElement,
          ),
        container: () => byId(ids.content),
        initialFocus: () => false,
        // Restore is idle's entry: never between steps (focus does not hop).
        finalFocus: () => false,
        modality: env.modality.modality(),
        dismiss: {
          escape: props.closeOnEscape !== false,
          outsidePress: props.closeOnOutsidePress === true,
          outsideFocus: props.closeOnOutsideFocus === true,
          isInside: (node) => {
            const t = target()
            return (
              (!!t && t.contains(node)) ||
              (props.persistentElements?.() ?? []).some((el) => el.contains(node))
            )
          },
          onRequest: (request) => {
            if (request.reason === "parent-dismissed") send({ type: "api" })
            else send({ type: request.reason, request })
            // A controlled parent or a veto kept it open: nothing beneath is dismissed.
            if (!closed) request.cancel()
          },
        },
      })
      const layer = getLayerStack(documentOf(env)).get(id)
      const stopTabOrder =
        modal || centered || !layer
          ? () => {}
          : trackNonModalTabOrder(env, {
              trigger: () => tabStopFor(env, target()),
              content: () => byId(ids.content),
              layer,
            })
      return () => {
        closed = true
        stopTabOrder()
        stop()
      }
    },
    /**
     * The shown step's DOM: scroll into view, positioning on a virtual padded anchor, the
     * spotlight geometry painted from the same passes, the target mark and watch, arrow keys,
     * and the first-placement focus or announcement (design §4, §6, §7, §8).
     */
    show: (a) => {
      const { env, props, send } = a
      if (typeof document === "undefined") return undefined
      const doc = documentOf(env)
      const view = doc.defaultView
      const ids = tourIds(props.root)
      const byId = (id: string) => env.dom.getById(id)
      const stepAt = () => resolveStep(props, a.context.patches, a.values.stepId)
      const step = stepAt()
      if (!step) return undefined
      const centered = a.context.targetMissing || !isAnchored(step)
      const cleanups: (() => void)[] = []
      const startModality = env.modality.modality()
      const focusBefore = deepActiveElement(doc)
      const firstOfRun = !a.context.shownOnce
      const focusWasInside = a.context.focusWasInside
      let current: Element | null = centered ? null : (step.target?.() ?? null)

      // The target mark (exact restore of a previous value).
      const MARK = "data-rind-tour-target"
      let marked: { el: Element; prev: string | null } | null = null
      const mark = (el: Element | null) => {
        if (marked) {
          if (marked.prev === null) marked.el.removeAttribute(MARK)
          else marked.el.setAttribute(MARK, marked.prev)
          marked = null
        }
        if (el) {
          marked = { el, prev: el.getAttribute(MARK) }
          el.setAttribute(MARK, props.root)
        }
      }
      mark(current)
      cleanups.push(() => mark(null))

      // Scrolling: the author's scroll-margin / scroll-padding apply; never moves focus.
      if (current && step.scroll !== false && typeof current.scrollIntoView === "function") {
        current.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: env.motion.reducedMotion() ? "instant" : "auto",
          ...step.scroll,
        })
      }

      // Spotlight and backdrop geometry, coalesced to one write per microtask.
      const padding = spotlightPadding(props.spotlight)
      const radius = props.spotlight?.radius ?? 8
      const cardCutout = contentCutout(props.spotlight)
      let paintQueued = false
      let markerWaits = 3
      const paint = () => {
        paintQueued = false
        // all in the backdrop's own pixels: rects and the visual viewport are viewport pixels,
        // which a zoomed page multiplies again when they are written (css-zoom.ts)
        const z = cssZoom(byId(ids.backdrop) ?? doc.documentElement)
        const own = (r: DOMRect) => new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z)
        const vv = view?.visualViewport
        const viewport = {
          width: vv ? vv.width / z : doc.documentElement.clientWidth,
          height: vv ? vv.height / z : doc.documentElement.clientHeight,
        }
        const t =
          current && isRendered(current) ? rectOf(own(current.getBoundingClientRect())) : undefined
        const shown = cardCutout ? byId(ids.content)?.getBoundingClientRect() : undefined
        const card = shown ? own(shown) : undefined
        const cutouts = cutoutsFor({
          target: centered ? undefined : t,
          content: card ? rectOf(card) : undefined,
          viewport,
          padding,
          radius,
          contentCutout: cardCutout,
        })
        const backdrop = byId(ids.backdrop)
        if (backdrop) {
          backdrop.style.setProperty(
            "clip-path",
            `path(evenodd, "${spotlightPath(viewport, cutouts)}")`,
          )
          backdrop.style.setProperty("--rind-tour-viewport-width", `${viewport.width}px`)
          backdrop.style.setProperty("--rind-tour-viewport-height", `${viewport.height}px`)
        }
        const spot = byId(ids.spotlight)
        // A step change animates only once connect's `data-step-changing` is in the DOM:
        // until the framework commits it, keep the old geometry (a frame or two at most).
        if (spot && a.context.stepChanging && !spot.hasAttribute("data-step-changing")) {
          if (markerWaits-- > 0) {
            const f = env.scheduler.requestAnimationFrame(paint)
            cleanups.push(() => env.scheduler.cancelAnimationFrame(f))
            return
          }
        }
        if (spot && t) {
          spot.style.setProperty("--rind-tour-spotlight-x", `${t.x - padding.x}px`)
          spot.style.setProperty("--rind-tour-spotlight-y", `${t.y - padding.y}px`)
          spot.style.setProperty("--rind-tour-spotlight-width", `${t.width + 2 * padding.x}px`)
          spot.style.setProperty("--rind-tour-spotlight-height", `${t.height + 2 * padding.y}px`)
          spot.style.setProperty(
            "--rind-tour-spotlight-radius",
            `${Math.min(radius, (t.width + 2 * padding.x) / 2, (t.height + 2 * padding.y) / 2)}px`,
          )
        }
      }
      const schedulePaint = () => {
        if (paintQueued) return
        paintQueued = true
        queueMicrotask(() => {
          if (!stopped) paint()
        })
      }
      let stopped = false
      cleanups.push(() => {
        stopped = true
      })
      schedulePaint()
      // The card's own writes (positioning moves it): repaint in the same frame.
      const positionerObserver = new MutationObserver(schedulePaint)
      const observePositioner = () => {
        const p = byId(ids.positioner)
        if (p) positionerObserver.observe(p, { attributes: true, attributeFilter: ["style"] })
        return !!p
      }
      cleanups.push(() => positionerObserver.disconnect())
      if (view) {
        view.addEventListener("resize", schedulePaint)
        cleanups.push(() => view.removeEventListener("resize", schedulePaint))
      }

      // First placement of the step: focus (first step) or recover + announce (later).
      let cancelFocus = () => {}
      cleanups.push(() => cancelFocus())
      const onFirstPlaced = () => {
        const content = byId(ids.content)
        if (!content) return
        if (firstOfRun) {
          const pick = props.initialFocus
          cancelFocus = focusInitial(
            env,
            content,
            () => (pick ? (pick() ?? content) : content),
            startModality,
            focusBefore,
          )
          return
        }
        const active = deepActiveElement(doc)
        const inside = !!active && containsDeep(content, active)
        const lost = !active || active === doc.body || (focusWasInside && !inside)
        if (lost) {
          void focusSafely(content, env, "layer")
          return
        }
        const { current: n, total } = progressOf(props.steps, step.id)
        const title = byId(ids.title)?.textContent?.trim() ?? ""
        env.announcer.announce({
          message: props.messages.stepAnnouncement({ current: n, total, title }),
          priority: "polite",
          key: `tour-${props.root}`,
        })
      }

      if (centered) {
        // Placed by CSS: the first placement is the content's mount.
        let frame: ReturnType<typeof env.scheduler.requestAnimationFrame> | null = null
        // Bounded: a tour rendered without Content stops looking after about two seconds.
        let left = 120
        const wait = () => {
          frame = null
          if (stopped) return
          if (!byId(ids.content)) {
            if (left-- > 0) frame = env.scheduler.requestAnimationFrame(wait)
            return
          }
          schedulePaint()
          send({
            type: "POSITION.PLACED",
            side: "bottom",
            align: "center",
            anchorHidden: false,
            first: true,
          })
          onFirstPlaced()
        }
        frame = env.scheduler.requestAnimationFrame(wait)
        cleanups.push(() => {
          if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
        })
      } else {
        const track = env.position.track({
          anchor: {
            kind: "virtual",
            get: () => {
              const el = stepAt()?.target?.() ?? current
              if (!el) return null
              return {
                contextElement: el,
                getBoundingClientRect: () => {
                  const r = el.getBoundingClientRect()
                  schedulePaint()
                  const x = r.x - padding.x
                  const y = r.y - padding.y
                  const width = r.width + 2 * padding.x
                  const height = r.height + 2 * padding.y
                  return {
                    x,
                    y,
                    width,
                    height,
                    top: y,
                    left: x,
                    right: x + width,
                    bottom: y + height,
                  }
                },
              }
            },
          },
          positioner: ids.positioner,
          arrow: ids.arrow,
          options: () => stepPositioning(stepAt() ?? step),
          onPlacement: (p, first) => {
            if (first) observePositioner()
            send({ type: "POSITION.PLACED", ...p, first })
            if (first) onFirstPlaced()
          },
        })
        cleanups.push(() => track.stop())

        // The target replaced or lost (design §4): one getter call per microtask.
        let checkQueued = false
        const check = () => {
          checkQueued = false
          if (stopped) return
          const el = stepAt()?.target?.() ?? null
          if (!isRendered(el)) {
            send({ type: "TARGET.LOST" })
            return
          }
          if (el !== current) {
            current = el
            mark(el)
            track.reposition()
            schedulePaint()
          }
        }
        const watcher = new MutationObserver(() => {
          if (checkQueued) return
          checkQueued = true
          queueMicrotask(check)
        })
        watcher.observe(env.dom.getRootNode(), {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class", "hidden"],
        })
        cleanups.push(() => watcher.disconnect())
      }

      // Arrow keys inside the card (design §7).
      const onKeyDown = (e: KeyboardEvent) => {
        if (props.keyboardNavigation === false) return
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
        if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
          return
        const content = byId(ids.content)
        const t = e.target
        if (!content || !(t instanceof Element) || !containsDeep(content, t)) return
        if (t instanceof HTMLElement && t.isContentEditable) return
        if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
        if (
          t instanceof HTMLInputElement &&
          !["checkbox", "button", "submit", "reset", "file", "image", "color"].includes(t.type)
        )
          return
        // Widgets whose own arrows move inside them (a radio group, a slider, tabs, a menu).
        if (
          t.closest(
            '[role="radiogroup"],[role="slider"],[role="tablist"],[role="menu"],[role="menubar"],[role="listbox"],[role="grid"],[role="tree"]',
          )
        )
          return
        const rtl = content.closest("[dir]")?.getAttribute("dir") === "rtl"
        const forward = (e.key === "ArrowRight") !== rtl
        const steps = props.steps
        const at = indexOf(steps, a.values.stepId)
        // The ends of the tour: the keys never complete or close it.
        if (forward ? nextIndex(steps, at) < 0 : prevIndex(steps, at) < 0) return
        e.preventDefault()
        send(forward ? { type: "STEP.NEXT" } : { type: "STEP.PREV" })
      }
      doc.addEventListener("keydown", onKeyDown)
      cleanups.push(() => doc.removeEventListener("keydown", onKeyDown))

      return () => {
        for (const c of cleanups.splice(0).reverse()) c()
      }
    },
    /** A wait step: no layer of its own, but Escape still ends the tour when topmost. */
    waitKeys: (a) => {
      const { env, props, send } = a
      if (typeof document === "undefined" || props.closeOnEscape === false) return undefined
      const doc = documentOf(env)
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || e.defaultPrevented) return
        if (getLayerStack(doc).layers().length > 0) return
        send({ type: "escape-key" })
      }
      doc.addEventListener("keydown", onKeyDown)
      return () => doc.removeEventListener("keydown", onKeyDown)
    },
    /** Prepares the announcer while a run may announce. */
    prepareAnnouncer: (a) => a.env.announcer.prepare(),
  },
}).machine({
  id: "tour",
  initial: "idle",
  context: (props) => {
    validateSteps(props.steps)
    return {
      pendingId: null,
      direction: "forward",
      visit: null,
      keepVisit: false,
      targetMissing: false,
      placement: unplaced("bottom", "center"),
      closeReason: null,
      patches: {},
      shownOnce: false,
      focusWasInside: false,
      startFocus: null,
      ran: false,
      stepChanging: false,
    }
  },
  values: {
    open: {
      fallback: false,
      states: { idle: false, preparing: true, active: true, waiting: true },
    },
    stepId: { fallback: "" },
  },
  onProps: { steps: "STEPS.SET", stepId: "STEP.SYNCED" },
  states: {
    idle: {
      entry: ["restoreFocus"],
      exit: ["beginRun"],
      on: {
        START: { target: "preparing", actions: ["recordStart"] },
        "STEPS.SET": { actions: ["validate"] },
      },
    },
    preparing: {
      exit: ["handOff"],
      effects: ["visit", "prepareAnnouncer"],
      on: {
        "STEP.READY": [
          { guard: "isWaitStep", target: "waiting", actions: ["adoptVisit"] },
          { target: "active", actions: ["adoptVisit"] },
        ],
        "STEP.MISSING": [
          { guard: "policyCenter", target: "active", actions: ["reportMissing", "adoptVisit"] },
          {
            guard: "policyStop",
            target: "idle",
            reason: "target-missing",
            actions: ["reportMissing", "closeTargetMissing"],
          },
          {
            guard: "skipFinds",
            target: "preparing",
            reenter: true,
            actions: ["reportMissing", "setPendingSkip"],
          },
          {
            guard: "skipForward",
            target: "idle",
            reason: "complete",
            actions: ["reportMissing", "closeComplete"],
          },
          {
            target: "idle",
            reason: "target-missing",
            actions: ["reportMissing", "closeTargetMissing"],
          },
        ],
        // Next / Back from the card are ignored while preparing (double press); an effect's
        // own next() skips its step.
        "STEP.NEXT": [
          {
            guard: "effectHasNext",
            target: "preparing",
            reenter: true,
            actions: ["setPendingNextOfPending"],
          },
          { guard: "fromEffect", target: "idle", reason: "complete", actions: ["closeComplete"] },
        ],
        "STEP.GOTO": {
          guard: "knownStep",
          target: "preparing",
          reenter: true,
          actions: ["setPendingGoto"],
        },
        "STEP.SYNCED": {
          guard: "syncedElsewhere",
          target: "preparing",
          reenter: true,
          actions: ["setPendingSynced"],
        },
        START: { target: "preparing", reenter: true, actions: ["recordStart"] },
        "STEP.UPDATE": { actions: ["applyPatch"] },
        "STEPS.SET": [
          {
            guard: "pendingGone",
            target: "idle",
            reason: "steps-changed",
            actions: ["closeStepsChanged"],
          },
          { actions: ["validate"] },
        ],
        dismiss: { target: "idle", actions: ["closeFromEvent"] },
        skip: { target: "idle", actions: ["closeFromEvent"] },
        "escape-key": { guard: "closesOnEscape", target: "idle", actions: ["closeFromEvent"] },
        api: { target: "idle", actions: ["closeFromEvent"] },
      },
    },
    active: {
      entry: ["enterShown"],
      exit: ["noteKeep"],
      effects: ["holdVisit", "overlay", "show", "prepareAnnouncer"],
      on: {
        "STEP.NEXT": [
          { guard: "hasNext", target: "preparing", actions: ["noteFocus", "setPendingNext"] },
          { target: "idle", reason: "complete", actions: ["closeComplete"] },
        ],
        "STEP.PREV": {
          guard: "hasPrev",
          target: "preparing",
          actions: ["noteFocus", "setPendingPrev"],
        },
        "STEP.GOTO": {
          guard: "knownStep",
          target: "preparing",
          actions: ["noteFocus", "setPendingGoto"],
        },
        "STEP.SYNCED": {
          guard: "syncedElsewhere",
          target: "preparing",
          actions: ["noteFocus", "setPendingSynced"],
        },
        "STEP.RESUME": { target: "preparing", actions: ["setPendingSame"] },
        START: { target: "preparing", actions: ["noteFocus", "recordStart"] },
        "TARGET.LOST": { target: "preparing", actions: ["setPendingSame"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
        "POSITION.REPOSITION": { actions: ["reposition"] },
        "SPOTLIGHT.SETTLED": { actions: ["settleSpotlight"] },
        "STEP.UPDATE": { actions: ["applyPatch"] },
        "STEPS.SET": [
          {
            guard: "shownGone",
            target: "idle",
            reason: "steps-changed",
            actions: ["closeStepsChanged"],
          },
          { actions: ["validate"] },
        ],
        dismiss: [
          { guard: "isLastShown", target: "idle", reason: "complete", actions: ["closeComplete"] },
          { target: "idle", actions: ["closeFromEvent"] },
        ],
        skip: { target: "idle", actions: ["closeFromEvent"] },
        "escape-key": { guard: "closesOnEscape", target: "idle", actions: ["closeFromEvent"] },
        "outside-press": {
          guard: "closesOnOutsidePress",
          target: "idle",
          actions: ["closeFromEvent"],
        },
        "outside-focus": {
          guard: "closesOnOutsideFocus",
          target: "idle",
          actions: ["closeFromEvent"],
        },
        api: { target: "idle", actions: ["closeFromEvent"] },
      },
    },
    waiting: {
      exit: ["noteKeep"],
      effects: ["holdVisit", "waitKeys"],
      on: {
        "STEP.NEXT": [
          { guard: "hasNext", target: "preparing", actions: ["setPendingNext"] },
          { target: "idle", reason: "complete", actions: ["closeComplete"] },
        ],
        "STEP.PREV": { guard: "hasPrev", target: "preparing", actions: ["setPendingPrev"] },
        "STEP.GOTO": { guard: "knownStep", target: "preparing", actions: ["setPendingGoto"] },
        "STEP.SYNCED": {
          guard: "syncedElsewhere",
          target: "preparing",
          actions: ["setPendingSynced"],
        },
        "STEP.RESUME": { target: "preparing", actions: ["setPendingSame"] },
        START: { target: "preparing", actions: ["recordStart"] },
        "STEP.UPDATE": { actions: ["applyPatch"] },
        "STEPS.SET": [
          {
            guard: "shownGone",
            target: "idle",
            reason: "steps-changed",
            actions: ["closeStepsChanged"],
          },
          { actions: ["validate"] },
        ],
        dismiss: { target: "idle", actions: ["closeFromEvent"] },
        skip: { target: "idle", actions: ["closeFromEvent"] },
        "escape-key": { guard: "closesOnEscape", target: "idle", actions: ["closeFromEvent"] },
        api: { target: "idle", actions: ["closeFromEvent"] },
      },
    },
  },
})

export type TourMachine = typeof tourMachine
