import type { Collection, SelectOpenChangeDetails, selectPositioning } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { ListboxItemData } from "../listbox/types"

/** `onValueChange`'s details: why the value changed. */
export interface SelectValueChangeDetails {
  readonly reason: "select" | "typeahead" | "reset" | "autofill"
}

/** What `bind:actions` exposes. */
export interface SelectActions {
  open(): void
  close(): void
}

export interface SelectTriggerState {
  readonly open: boolean
  readonly placeholder: boolean
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

type Common = {
  /** The base the parts' ids derive from. Default: generated. */
  readonly id?: string | undefined
  readonly children?: Snippet | undefined
  /** Data items: the value text needs no option mounted (a closed select mounts none). */
  readonly items?: readonly ListboxItemData[] | undefined
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown> | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: SelectOpenChangeDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** A disabled trigger stays focusable (`aria-disabled`), and disabled options stay navigable. */
  readonly focusableWhenDisabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly autoComplete?: string | undefined
  /** Shown while nothing is selected. */
  readonly placeholder?: string | undefined
  /** Default false (a native select does not wrap). */
  readonly loop?: boolean | undefined
  readonly typeaheadTimeout?: number | undefined
  readonly positioning?: Parameters<typeof selectPositioning>[0]["positioning"] | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** `bind:actions`: open, close. */
  actions?: SelectActions | undefined
}

export type SelectRootProps = Common &
  (
    | {
        readonly multiple?: false | undefined
        /** The value; `bind:value` controls it. */
        value?: string | null | undefined
        readonly defaultValue?: string | null | undefined
        readonly onValueChange?:
          | ((value: string | null, details: SelectValueChangeDetails) => void)
          | undefined
      }
    | {
        readonly multiple: true
        value?: readonly string[] | undefined
        readonly defaultValue?: readonly string[] | undefined
        readonly onValueChange?:
          | ((value: readonly string[], details: SelectValueChangeDetails) => void)
          | undefined
      }
  )

export type SelectLabelProps = Part<HTMLAttributes<HTMLSpanElement>>
export type SelectTriggerProps = Part<HTMLButtonAttributes, SelectTriggerState>
export type SelectValueTextProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** Render the selected items yourself (an icon next to the text). */
  readonly children?: Snippet<[readonly string[]]> | undefined
}
export type SelectIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>>
export type SelectDescriptionProps = Part<HTMLAttributes<HTMLDivElement>>
export type SelectPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type SelectContentProps = Part<HTMLAttributes<HTMLDivElement>>
