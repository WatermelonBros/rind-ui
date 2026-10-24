import type {
  HeadingLevel,
  MessageOverrides,
  Service,
  TourAction,
  TourCloseReason,
  TourDirection,
  TourMessages,
  TourProps,
  TourStep,
  tourMachine,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    tour: TourMessages
  }
}

/** A step: its title, description and action labels are text or snippets. */
export type TourStepDef = TourStep<string | Snippet>

/** What `onOpenChange` receives. */
export interface TourOpenChangeDetails {
  readonly reason: TourCloseReason | "api"
  readonly stepId: string | null
  readonly stepIndex: number
  /** True only for reason `complete`. */
  readonly complete: boolean
  cancel(): void
}

/** What `onStepChange` receives. */
export interface TourStepChangeDetails {
  readonly stepIndex: number
  /** Steps that are not wait steps. */
  readonly totalSteps: number
  /** 0–1, over the steps that are not wait steps. */
  readonly progress: number
  readonly direction: TourDirection
  readonly reason: "start" | "next" | "prev" | "goto"
  cancel(): void
}

export type UseTourProps = Omit<
  TourProps,
  "root" | "parent" | "steps" | "messages" | "onOpenChange" | "stepId" | "onStepIdChange"
> & {
  /** Base for the ids of the tour's parts. Default: generated. */
  readonly id?: string | undefined
  readonly steps: readonly TourStepDef[]
  readonly stepId?: string | null | undefined
  readonly onOpenChange?: ((open: boolean, details: TourOpenChangeDetails) => void) | undefined
  readonly onStepChange?: ((stepId: string, details: TourStepChangeDetails) => void) | undefined
  readonly messages?: MessageOverrides<TourMessages> | undefined
}

/** What `useTour` returns and `Tour.Root tour` accepts; the getters stay reactive. */
export interface TourHandle {
  readonly service: Service<typeof tourMachine>
  /** The machine's view (reactive). */
  readonly view: ReturnType<Service<typeof tourMachine>["view"]>
  readonly root: string
  readonly props: TourProps
  readonly messages: TourMessages
  /** The tour runs (a step is prepared, shown or waited on). */
  readonly open: boolean
  /** The shown step's id, or null. */
  readonly stepId: string | null
  /** The shown step's 0-based index, or -1. */
  readonly stepIndex: number
  readonly steps: readonly TourStepDef[]
  /** Opens at the first step, or at `stepId`; while open, goes to that step. */
  start(options?: { readonly stepId?: string }): void
  /** Ends the tour with reason `api`. */
  stop(): void
  next(): void
  prev(): void
  goto(id: string): void
  /** Recomputes the card and spotlight now (a target that moved without any event). */
  reposition(): void
  setSteps(steps: readonly TourStepDef[]): void
  addStep(step: TourStepDef, index?: number): void
  removeStep(id: string): void
  updateStep(id: string, patch: Partial<Omit<TourStepDef, "id">>): void
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export interface TourTriggerState {
  readonly open: boolean
}
export interface TourContentState {
  readonly open: boolean
  readonly stepId: string | null
}

export type TourRootProps = (
  | ({ readonly tour: TourHandle } & { readonly [K in keyof UseTourProps]?: never })
  | (UseTourProps & { readonly tour?: never })
) & {
  /** The tour's parts. */
  readonly children?: Snippet | undefined
}
export type TourTriggerProps = Part<HTMLButtonAttributes, TourTriggerState>
export type TourBackdropProps = Part<HTMLAttributes<HTMLDivElement>>
export type TourSpotlightProps = Part<HTMLAttributes<HTMLDivElement>>
export type TourPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type TourContentProps = Part<HTMLAttributes<HTMLDivElement>, TourContentState>
export type TourArrowProps = Part<HTMLAttributes<HTMLDivElement>>
export type TourTitleProps = Part<HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the card are one level below. */
  readonly level?: HeadingLevel | undefined
}
export type TourDescriptionProps = Part<HTMLAttributes<HTMLParagraphElement>>
export type TourProgressTextProps = Part<HTMLAttributes<HTMLSpanElement>>
export interface TourActionsProps {
  /** Renders the shown step's actions. */
  readonly children: Snippet<[readonly TourAction<string | Snippet>[]]>
}
export type TourActionTriggerProps = Part<HTMLButtonAttributes> & {
  readonly action: TourAction<string | Snippet>
}
export type TourCloseTriggerProps = Part<HTMLButtonAttributes>
