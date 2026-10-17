// Tour parts (design §9): every ARIA and data attribute of the spec. The positioner and arrow
// come from the positioning helpers (a centred step is placed by CSS instead); the spotlight
// geometry itself is painted by the machine's `show` effect, never here, so a framework style
// diff cannot fight it.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LayerMeta } from "../../dom/layer-stack"
import type { LinkEnv } from "../../dom/link"
import {
  arrowProps,
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import { type HeadingLevel, headingProps } from "../heading/heading.connect"
import { buttonLikeProps } from "../shared/button-like"
import { type TourEvent, tourIds } from "./tour.machine"
import type { TourMessages } from "./tour.messages"
import {
  indexOf,
  isAnchored,
  nextIndex,
  prevIndex,
  progressOf,
  stepType,
  type TourAction,
  type TourActionApi,
  type TourActionKind,
  type TourCloseReason,
  type TourPhase,
  type TourStep,
} from "./tour.steps"

export type TourPart =
  | "trigger"
  | "backdrop"
  | "spotlight"
  | "positioner"
  | "content"
  | "arrow"
  | "title"
  | "description"
  | "progress-text"
  | "action-trigger"
  | "close-trigger"

export type TourMachineState = "idle" | "preparing" | "active" | "waiting"

export interface TourConnectInput {
  readonly instance: string
  readonly state: TourMachineState
  readonly steps: readonly TourStep[]
  /** The shown step, patches applied (undefined while idle before the first step). */
  readonly step: TourStep | undefined
  /** The shown step is a missing target shown centred. */
  readonly targetMissing: boolean
  readonly modal: boolean
  readonly placement: PlacementState
  readonly closeReason: TourCloseReason | null
  /** A step was placed since the start: the backdrop may paint. */
  readonly shownOnce: boolean
  readonly preventTargetInteraction: boolean
  /** Ids of the mounted title and description: the only source of the ARIA references. */
  readonly rendered: {
    readonly title?: string | undefined
    readonly description?: string | undefined
  }
  readonly contentMounted: boolean
  readonly meta?: LayerMeta | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  readonly focusWithin?: boolean | undefined
  readonly contentFocused?: boolean | undefined
  readonly modality?: Modality | undefined
  readonly messages: TourMessages
}

/** One button-like part's own state. */
export interface TourButtonState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
}

// Sound: without an href the link branch, the only reader of the link env, is never taken.
const NO_LINK = {} as LinkEnv

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

const phaseOf = (state: TourMachineState): TourPhase =>
  state === "active" ? "shown" : state === "idle" ? "idle" : state

export function tourConnect(input: TourConnectInput, send: (event: TourEvent) => void) {
  const { instance, step, steps } = input
  const ids = tourIds(instance)
  const running = input.state !== "idle"
  const shown = input.state === "active"
  const phase = phaseOf(input.state)
  const centered = !step || input.targetMissing || !isAnchored(step)
  const type = step ? (input.targetMissing ? "dialog" : stepType(step)) : undefined
  const at = indexOf(steps, step?.id)
  const first = at >= 0 && prevIndex(steps, at) < 0
  const last = at >= 0 && nextIndex(steps, at) < 0
  const progress = progressOf(steps, step?.id)
  // Backdrop below spotlight below positioner, all under the next layer up: fractions that
  // round to the layer's own z-index (DOM order stacks them within it).
  const layerIndex = (offset: number) =>
    input.meta ? { "--layer-index": String(input.meta.index - (2 - offset) / 10) } : {}
  const shield = input.preventTargetInteraction || step?.preventTargetInteraction === true

  const api: TourActionApi = {
    next: () => send({ type: "STEP.NEXT" }),
    prev: () => send({ type: "STEP.PREV" }),
    dismiss: () => send({ type: "dismiss" }),
    skip: () => send({ type: "skip" }),
    goto: (id) => send({ type: "STEP.GOTO", id }),
  }
  const kindOf = (a: TourAction): TourActionKind | "custom" =>
    typeof a.action === "function" ? "custom" : a.action
  const nameOf = (kind: TourActionKind | "custom") =>
    kind === "next"
      ? last
        ? input.messages.finish
        : input.messages.next
      : kind === "prev"
        ? input.messages.prev
        : kind === "skip"
          ? input.messages.skip
          : kind === "dismiss"
            ? input.messages.close
            : undefined
  const disabledOf = (kind: TourActionKind | "custom") => kind === "prev" && first

  return {
    open: running,
    phase,
    step,
    stepIndex: at,
    first,
    last,
    progress,
    centered,
    /** The current step's actions (what `Actions` calls its children with). */
    actions: step?.actions ?? [],
    trigger: (s: TourButtonState & { readonly tag: string }): PartProps => ({
      ...scopeAttrs("tour", "trigger", instance),
      // A substituted element (a div) gets the button role and a tab stop.
      ...buttonLikeProps(
        { role: "button", tag: s.tag, disabled: false, focusableWhenDisabled: false },
        NO_LINK,
      ),
      id: ids.trigger,
      "aria-haspopup": "dialog",
      "aria-expanded": String(running),
      "aria-controls": input.contentMounted ? ids.content : undefined,
      "data-state": running ? "open" : "closed",
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
      [CRITICAL]: ["aria-expanded"],
    }),
    backdrop: (): PartProps => ({
      ...scopeAttrs("tour", "backdrop", instance),
      id: ids.backdrop,
      "aria-hidden": "true",
      "data-state": running ? "open" : "closed",
      "data-phase": phase,
      "data-step-type": type,
      style: {
        position: "fixed",
        inset: "0",
        "pointer-events": "none",
        // Not painted before the first placement of the run (no stale or origin frame).
        ...(input.shownOnce ? {} : { visibility: "hidden" }),
        ...layerIndex(0),
      },
    }),
    spotlight: (): PartProps => ({
      ...scopeAttrs("tour", "spotlight", instance),
      id: ids.spotlight,
      "aria-hidden": "true",
      "data-state": shown ? "open" : "closed",
      "data-shield": dataFlag(shield),
      hidden: centered || !input.placement.placed ? true : undefined,
      style: {
        position: "fixed",
        left: "var(--rind-tour-spotlight-x, 0px)",
        top: "var(--rind-tour-spotlight-y, 0px)",
        width: "var(--rind-tour-spotlight-width, 0px)",
        height: "var(--rind-tour-spotlight-height, 0px)",
        "pointer-events": shield ? "auto" : "none",
        ...layerIndex(1),
      },
    }),
    positioner: (): PartProps => {
      const own = centered
        ? {
            id: ids.positioner,
            dir: input.dir,
            "data-side": undefined,
            "data-align": "center",
            style: {
              "--rind-available-width": "100vw",
              "--rind-available-height": "100vh",
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            },
          }
        : positionerProps(
            input.placement,
            { positioner: ids.positioner, anchor: ids.spotlight },
            { dir: input.dir },
          )
      // Sound: both branches build `style` as a string record (positionerProps does too).
      const style = (own["style"] ?? {}) as Record<string, string>
      return {
        ...scopeAttrs("tour", "positioner", instance),
        ...own,
        "data-state": shown ? "open" : "closed",
        "data-phase": phase,
        "data-step-type": type,
        "data-modal": dataFlag(input.modal),
        style: { ...style, ...layerIndex(2) },
      }
    },
    content: (own: {
      label?: string | undefined
      labelledBy?: string | undefined
      describedBy?: string | undefined
    }): PartProps => {
      // Title, then the consumer's own name, then "Step 3 of 12".
      const labelledBy = input.rendered.title ?? own.labelledBy
      const label = labelledBy
        ? undefined
        : (own.label ??
          input.messages.stepLabel({ current: progress.current, total: progress.total }))
      return {
        ...scopeAttrs("tour", "content", instance),
        ...(centered ? {} : contentPlacementProps(input.placement)),
        id: ids.content,
        role: "dialog",
        tabindex: -1,
        "aria-modal": input.modal ? "true" : undefined,
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-describedby": join(own.describedBy, input.rendered.description),
        "data-state": shown ? "open" : "closed",
        "data-phase": phase,
        "data-step": step?.id,
        // For the driver (stepIndex / totalSteps): 0-based index, steps that are not wait.
        "data-step-index": at >= 0 ? String(at) : undefined,
        "data-step-count": String(progress.total),
        "data-step-type": type,
        "data-modal": dataFlag(input.modal),
        "data-first": dataFlag(first),
        "data-last": dataFlag(last),
        "data-target-missing": dataFlag(input.targetMissing),
        "data-close-reason": running ? undefined : (input.closeReason ?? undefined),
        "data-focus-within": dataFlag(input.focusWithin === true),
        ...focusAttrs(input.contentFocused === true, input.modality ?? "keyboard"),
        style: {
          "--rind-tour-progress": String(progress.progress),
          ...(input.placement.placed || centered ? {} : { "animation-name": "none" }),
        },
      }
    },
    arrow: (): PartProps => ({
      ...scopeAttrs("tour", "arrow", instance),
      ...arrowProps(input.placement, ids.arrow),
      "data-align": input.placement.align,
      // Only for an anchored step that wants it, and not while the card covers its target.
      hidden:
        centered ||
        step?.arrow === false ||
        (input.placement.placed && input.placement.anchorHidden)
          ? true
          : undefined,
    }),
    title: (own: { level: HeadingLevel; tag: string }): PartProps => ({
      ...scopeAttrs("tour", "title", instance),
      ...headingProps({ level: own.level, tag: own.tag }),
      id: ids.title,
    }),
    description: (): PartProps => ({
      ...scopeAttrs("tour", "description", instance),
      id: ids.description,
    }),
    progressText: (): PartProps => scopeAttrs("tour", "progress-text", instance),
    /** The progress text: 1-based, wait steps not counted. */
    progressLabel: () =>
      input.messages.progressText({ current: progress.current, total: progress.total }),
    actionTrigger: (
      action: TourAction,
      s: TourButtonState & { readonly empty: boolean },
    ): PartProps => {
      const kind = kindOf(action)
      const disabled = disabledOf(kind)
      return {
        ...scopeAttrs("tour", "action-trigger", instance),
        type: "button",
        "aria-label": s.empty ? nameOf(kind) : undefined,
        "aria-disabled": disabled ? "true" : undefined,
        "data-disabled": dataFlag(disabled),
        "data-action": kind,
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
      }
    },
    closeTrigger: (s: TourButtonState & { readonly empty: boolean }): PartProps => ({
      ...scopeAttrs("tour", "close-trigger", instance),
      type: "button",
      "aria-label": s.empty ? input.messages.close : undefined,
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
    }),
    /** Press handlers: the adapter wires them through press interactions. */
    pressTrigger: (modality: Modality) => (running ? undefined : send({ type: "START", modality })),
    pressAction: (action: TourAction) => {
      const kind = kindOf(action)
      if (disabledOf(kind)) return
      if (typeof action.action === "function") action.action(api)
      else api[action.action]()
    },
    pressClose: () => send({ type: "dismiss", close: true }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
  }
}

export type TourApi = ReturnType<typeof tourConnect>
