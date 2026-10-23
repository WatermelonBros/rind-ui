import type { ChangeDetails, RadioGroupEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface RadioGroupState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface RadioItemState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type RadioGroupRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The checked radio's value; `bind:value` controls it. */
  value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<RadioGroupEvent>) => void)
    | undefined
  /** Only `aria-orientation` and `data-orientation`: every arrow key moves. */
  readonly orientation?: "vertical" | "horizontal" | undefined
  /** Disables every radio. */
  readonly disabled?: boolean | undefined
  /** A disabled group stays discoverable: the root is one tab stop. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Navigable, never changes. */
  readonly readonly?: boolean | undefined
  /** Valid with one radio checked. */
  readonly required?: boolean | undefined
  /** Marks the group invalid; shows the ErrorMessage. */
  readonly invalid?: boolean | undefined
  /** Default: derived from the root id (two groups never form one browser group). */
  readonly name?: string | undefined
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string | undefined
  readonly child?: Snippet<[ChildArgs<RadioGroupState>]> | undefined
  readonly children?: Snippet<[RadioGroupState]> | undefined
}

type Part<A, S> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}
export type RadioGroupPartProps<E extends HTMLElement> = Part<HTMLAttributes<E>, undefined>
export type RadioGroupItemProps = Part<HTMLAttributes<HTMLDivElement>, RadioItemState> & {
  /** The item's value: what the group's value and the form submit. */
  readonly value: string
  /** Disables this radio only. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the item's text content). */
  readonly textValue?: string | undefined
}
export type RadioGroupItemControlProps = Part<HTMLButtonAttributes, RadioItemState>
export type RadioGroupItemIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>, RadioItemState>
export type RadioGroupItemLabelProps = Part<HTMLLabelAttributes, RadioItemState>
export type RadioGroupItemDescriptionProps = Part<
  HTMLAttributes<HTMLParagraphElement>,
  RadioItemState
>
