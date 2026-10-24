import type { ChangeDetails, RadioGroupEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface SegmentedControlState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface SegmentState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type SegmentedControlRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The checked segment's value; `bind:value` controls it. */
  value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<RadioGroupEvent>) => void)
    | undefined
  /** `aria-orientation`, `data-orientation` and the indicator only: every arrow key moves. */
  readonly orientation?: "horizontal" | "vertical" | undefined
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly readonly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** Default: derived from the root id. */
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly child?: Snippet<[ChildArgs<SegmentedControlState>]> | undefined
  readonly children?: Snippet<[SegmentedControlState]> | undefined
}
export type SegmentedControlLabelProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type SegmentedControlItemProps = Omit<HTMLButtonAttributes, "value" | "children"> & {
  /** The segment's value: what the control's value and the form submit. */
  readonly value: string
  /** Disables this segment: it cannot be checked. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the segment's text content). */
  readonly textValue?: string | undefined
  readonly child?: Snippet<[ChildArgs<SegmentState>]> | undefined
  readonly children?: Snippet<[SegmentState]> | undefined
}
export type SegmentedControlIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<{ readonly visible: boolean }>]> | undefined
  readonly children?: Snippet<[{ readonly visible: boolean }]> | undefined
}
