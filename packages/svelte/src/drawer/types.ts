import type {
  ChangeDetails,
  DrawerEvent,
  DrawerMessages,
  DrawerSide,
  MessageOverrides,
  SnapPoint,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { DialogRootProps } from "../dialog/types"

declare module "../provider" {
  interface RindMessageScopes {
    drawer: DrawerMessages
  }
}

export type DrawerRootProps = Omit<DialogRootProps, "messages" | "role"> & {
  readonly messages?: MessageOverrides<DrawerMessages> | undefined
  /** Default "bottom". Logical sides resolve from the direction. */
  readonly side?: DrawerSide | undefined
  /** Fraction of the content's size a release must reach to dismiss (default 0.5). */
  readonly swipeThreshold?: number | undefined
  /** px/ms toward the edge that dismisses (default 0.5). */
  readonly swipeVelocityThreshold?: number | undefined
  /** Default true; false keeps the gesture for snap points only. */
  readonly closeOnSwipe?: boolean | undefined
  readonly snapPoints?: readonly SnapPoint[] | undefined
  /** The snap point; `bind:snapPoint` controls it. */
  snapPoint?: SnapPoint | undefined
  readonly defaultSnapPoint?: SnapPoint | undefined
  readonly onSnapPointChange?:
    | ((value: SnapPoint, details: ChangeDetails<DrawerEvent>) => void)
    | undefined
  readonly snapToSequentialPoints?: boolean | undefined
}
export type DrawerPartProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
