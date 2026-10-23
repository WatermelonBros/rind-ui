import type { ChangeDetails, ToggleGroupEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { ToggleIndicatorProps, ToggleRootProps } from "../toggle/types"

export interface ToggleGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type ToggleGroupRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The pressed items' values; `bind:value` controls it. */
  value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<ToggleGroupEvent>) => void)
    | undefined
  /** Default `single`: pressing an item replaces the selection. */
  readonly selectionMode?: "single" | "multiple" | undefined
  /** The last pressed item cannot be released. */
  readonly disallowEmptySelection?: boolean | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly child?: Snippet<[ChildArgs<ToggleGroupState>]> | undefined
  readonly children?: Snippet<[ToggleGroupState]> | undefined
}

export interface ToggleGroupItemState {
  readonly pressed: boolean
  readonly disabled: boolean
}

export type ToggleGroupGroupItemProps = Omit<HTMLButtonAttributes, "value" | "children"> & {
  /** The item's key in the group's value. */
  readonly value: string
  /** Disables this item: it cannot be pressed. */
  readonly disabled?: boolean | undefined
  /** The item's text in the group's collection (icon-only items). Default: its text content. */
  readonly textValue?: string | undefined
  readonly child?: Snippet<[ChildArgs<ToggleGroupItemState>]> | undefined
  readonly children?: Snippet<[ToggleGroupItemState]> | undefined
}

/** Inside `ToggleGroup.Root` an item of the group; alone, a single toggle (`Toggle.Root`). */
export type ToggleGroupItemProps =
  | ToggleGroupGroupItemProps
  | (ToggleRootProps & { readonly value?: undefined; readonly textValue?: undefined })

export type ToggleGroupItemIndicatorProps = ToggleIndicatorProps
