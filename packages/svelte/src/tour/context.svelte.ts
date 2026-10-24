import {
  type HeadingLevel,
  isAnchoredTourStep,
  isStepModal,
  type LayerMeta,
  resolveStep,
  type TourContext,
  type TourMachineState,
  tourConnect,
} from "@rind-ui/core"
import { createContext } from "../context"
import type { TourHandle, TourStepDef } from "./types"

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

/** What the Root gives its parts. */
export interface TourCtx {
  readonly tour: TourHandle
  /** Mutable shared state (a `$state` object owned by the Root). */
  readonly shared: {
    contentMounted: boolean
    titleLevel: HeadingLevel
    rendered: Rendered
    meta: LayerMeta | undefined
  }
}
export const tourHost = createContext<TourCtx>("tour")

type Extra = {
  dir?: "ltr" | "rtl"
  focusWithin?: boolean
  contentFocused?: boolean
  modality?: Parameters<typeof tourConnect>[0]["modality"]
}

/** The tour's connect and the shown step. */
export function tourApi(ctx: TourCtx, extra: Extra = {}) {
  const { tour } = ctx
  const view = tour.view
  const state = view.state as TourMachineState
  const context = view.context as TourContext
  const step = resolveStep(tour.props, context.patches, view.values.stepId as string) as
    | TourStepDef
    | undefined
  const centered = !step || context.targetMissing || !isAnchoredTourStep(step)
  return {
    state,
    step,
    api: tourConnect(
      {
        instance: tour.root,
        state,
        steps: tour.props.steps,
        step,
        targetMissing: context.targetMissing,
        modal: !!step && isStepModal(tour.props, step, centered),
        placement: context.placement,
        closeReason: context.closeReason,
        shownOnce: context.shownOnce,
        stepChanging: context.stepChanging,
        preventTargetInteraction: tour.props.preventTargetInteraction === true,
        rendered: ctx.shared.rendered,
        contentMounted: ctx.shared.contentMounted,
        meta: ctx.shared.meta,
        ...extra,
        messages: tour.messages,
      },
      tour.service.send,
    ),
  }
}
