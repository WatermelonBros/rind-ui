import type {
  FieldMessages,
  MessageOverrides,
  NumberInputCommitDetails,
  NumberInputMessages,
  NumberInputReason,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { FieldOwnProps } from "../field/types"

declare module "../provider" {
  interface RindMessageScopes {
    "number-input": NumberInputMessages
  }
}

export interface NumberInputChangeDetails {
  readonly reason: NumberInputReason
  readonly modality: string | undefined
  cancel(): void
}
export interface NumberInputState {
  readonly value: number | null
  readonly text: string
  readonly spinning: boolean
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}
export type NumberInputRootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  keyof FieldOwnProps | "children" | "dir"
> &
  Omit<FieldOwnProps, "messages"> & {
    /** The number; `bind:value` controls it; `null` is empty. */
    value?: number | null | undefined
    /** Read at creation (default empty); a later change only changes what a form reset restores. */
    readonly defaultValue?: number | null | undefined
    readonly onValueChange?:
      | ((value: number | null, details: NumberInputChangeDetails) => void)
      | undefined
    /** Once per interaction that changed the value (key, stepper release, wheel tick, blur/Enter). */
    readonly onValueCommit?:
      | ((value: number | null, details: NumberInputCommitDetails) => void)
      | undefined
    /** Every accepted edit of the text (the value only changes at commit points). */
    readonly onInputValueChange?: ((text: string) => void) | undefined
    readonly min?: number | undefined
    readonly max?: number | undefined
    /** Default 1 (0.01 for percent). A commit snaps to an explicit step only. */
    readonly step?: number | undefined
    readonly largeStep?: number | undefined
    readonly formatOptions?: Intl.NumberFormatOptions | undefined
    readonly locale?: string | undefined
    readonly dir?: "ltr" | "rtl" | undefined
    readonly commitBehavior?: "snap" | "validate" | undefined
    readonly allowWheel?: boolean | undefined
    readonly spinOnPress?: boolean | undefined
    readonly spinDelay?: number | undefined
    readonly spinInterval?: number | undefined
    readonly form?: string | undefined
    readonly messages?: MessageOverrides<NumberInputMessages> | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
    readonly children?: Snippet | undefined
  }
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<NumberInputState>]> | undefined
  readonly children?: Snippet<[NumberInputState]> | undefined
}
export type NumberInputControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type NumberInputInputProps = Omit<
  HTMLInputAttributes,
  "value" | "defaultValue" | "children"
> & {
  readonly child?: Snippet<[ChildArgs<NumberInputState>]> | undefined
}
export type NumberInputTriggerProps = Part<HTMLButtonAttributes>
