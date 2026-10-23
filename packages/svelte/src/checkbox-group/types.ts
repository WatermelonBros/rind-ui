import type { ChangeDetails, CheckboxGroupEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface CheckboxGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type CheckboxGroupRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The checked items' values; `bind:value` controls it. */
  value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => void)
    | undefined
  /** Every item value: what the select-all Parent selects (required with a Parent). */
  readonly allValues?: readonly string[] | undefined
  readonly disabled?: boolean | undefined
  readonly readonly?: boolean | undefined
  /** Valid with at least one item checked. */
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** Submitted for every checked item (an item's own `name` is ignored). */
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly child?: Snippet<[ChildArgs<CheckboxGroupState>]> | undefined
  readonly children?: Snippet<[CheckboxGroupState]> | undefined
}

export type CheckboxGroupPartProps<E extends HTMLElement> = Omit<HTMLAttributes<E>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
