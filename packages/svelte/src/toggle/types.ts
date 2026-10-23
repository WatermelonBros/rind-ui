import type { ChangeDetails, ToggleEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface ToggleState {
  readonly pressed: boolean
  readonly disabled: boolean
}

export type ToggleRootProps = Omit<HTMLButtonAttributes, "type" | "children"> & {
  /** Pressed state; `bind:pressed` controls it. */
  pressed?: boolean | undefined
  /** Uncontrolled initial state. Default: false. */
  readonly defaultPressed?: boolean | undefined
  /** Every activation proposes the opposite value; `details.cancel()` vetoes it. */
  readonly onPressedChange?:
    | ((pressed: boolean, details: ChangeDetails<ToggleEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  /** Stays in the tab order while disabled (`aria-disabled`), e.g. for a tooltip. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Renders your own element: spread `props` on it. */
  readonly child?: Snippet<[ChildArgs<ToggleState>]>
  readonly children?: Snippet<[ToggleState]>
}

export type ToggleIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<ToggleState>]>
  readonly children?: Snippet<[ToggleState]>
  /** Rendered while the toggle is off (the children while it is on). */
  readonly fallback?: Snippet<[ToggleState]>
}
