import type {
  ChangeDetails,
  DialogChangeDetails,
  DialogProps,
  FloatingPanelEvent,
  FloatingPanelMessages,
  MessageOverrides,
  PanelStage,
} from "@rind-ui/core"
import type { ResizeAxis } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "floating-panel": FloatingPanelMessages
  }
}

/** A position in the boundary's content box, in px. */
export interface FloatingPanelPoint {
  readonly x: number
  readonly y: number
}
/** A size in px. */
export interface FloatingPanelSize {
  readonly width: number
  readonly height: number
}

/** What every part's snippets receive. */
export interface FloatingPanelRenderState {
  readonly open: boolean
  readonly stage: PanelStage
  readonly dragging: boolean
  readonly resizing: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<FloatingPanelRenderState>]> | undefined
  readonly children?: Snippet<[FloatingPanelRenderState]> | undefined
}

export type FloatingPanelRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  /** Uncontrolled visibility. Default false. */
  readonly defaultOpen?: boolean | undefined
  /** Opened or closed, with the reason. */
  readonly onOpenChange?: ((open: boolean, details: DialogChangeDetails) => void) | undefined
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  readonly initialFocus?: DialogProps["initialFocus"]
  /** `null`: back to the opener; `false`: focus does not move. */
  readonly finalFocus?: DialogProps["finalFocus"]
  /** Content and Positioner stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** The position in the boundary; `bind:position` controls it. */
  position?: FloatingPanelPoint | undefined
  /** Uncontrolled position. Default { x: 0, y: 0 }. */
  readonly defaultPosition?: FloatingPanelPoint | undefined
  /** Once per drag, per key step. */
  readonly onPositionChange?:
    | ((position: FloatingPanelPoint, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  /** The size; `bind:size` controls it. */
  size?: FloatingPanelSize | undefined
  /** Uncontrolled size. Default 360×240. */
  readonly defaultSize?: FloatingPanelSize | undefined
  /** Once per resize, per key step. */
  readonly onSizeChange?:
    | ((size: FloatingPanelSize, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  /** The stage; `bind:stage` controls it. */
  stage?: PanelStage | undefined
  /** Uncontrolled stage. Default "default". */
  readonly defaultStage?: PanelStage | undefined
  /** Minimised, maximised or restored. */
  readonly onStageChange?:
    | ((stage: PanelStage, details: ChangeDetails<FloatingPanelEvent>) => void)
    | undefined
  /** The smallest size. Default 200×120. */
  readonly minSize?: FloatingPanelSize | undefined
  /** The largest size (default: the boundary). */
  readonly maxSize?: FloatingPanelSize | undefined
  /** Pixels kept inside the boundary on each axis. Default 48. */
  readonly minVisible?: number | undefined
  /** Pixels per arrow key. Default 10. */
  readonly step?: number | undefined
  /** Pixels per Shift+arrow. Default 50. */
  readonly largeStep?: number | undefined
  /** Can be moved. Default true. */
  readonly draggable?: boolean | undefined
  /** Can be resized. Default true. */
  readonly resizable?: boolean | undefined
  /** No move, resize or stage change. */
  readonly disabled?: boolean | undefined
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<FloatingPanelMessages> | undefined
}

export type FloatingPanelPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type FloatingPanelButtonProps = Part<HTMLButtonAttributes>
export type FloatingPanelStageTriggerProps = FloatingPanelButtonProps & {
  /** The stage it switches to; pressed again from there, it restores. */
  readonly stage: "minimized" | "maximized"
}
export type FloatingPanelResizeTriggerProps = FloatingPanelPartProps & {
  /** The edge or corner it moves. */
  readonly axis: ResizeAxis
}
