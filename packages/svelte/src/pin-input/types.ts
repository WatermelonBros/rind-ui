import type {
  FieldMessages,
  MessageOverrides,
  PinInputMessages,
  PinInputReason,
  PinValidationType,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLInputAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { FieldOwnProps } from "../field/types"

declare module "../provider" {
  interface RindMessageScopes {
    "pin-input": PinInputMessages
  }
}

export interface PinInputChangeDetails {
  readonly reason: PinInputReason
}
export interface PinInputState {
  readonly value: string
  readonly complete: boolean
  readonly composing: boolean
  readonly focused: boolean
}
export type PinInputRootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  keyof FieldOwnProps | "children" | "dir"
> &
  Omit<FieldOwnProps, "messages"> & {
    /** The number of characters (a positive integer). */
    readonly length: number
    /** The code; `bind:value` controls it; `null` renders empty (ark#3573). */
    value?: string | null | undefined
    readonly defaultValue?: string | undefined
    readonly onValueChange?: ((value: string, details: PinInputChangeDetails) => void) | undefined
    /** An insertion was refused (its text). */
    readonly onValueInvalid?: ((text: string) => void) | undefined
    /** A user change completed the code. */
    readonly onValueComplete?: ((value: string) => void) | undefined
    /** Default `"numeric"`. */
    readonly validationType?: PinValidationType | undefined
    /** One accepted character (replaces `validationType`). */
    readonly pattern?: RegExp | undefined
    /** Applied after NFKC (e.g. `(t) => t.toUpperCase()`). */
    readonly sanitize?: ((text: string) => string) | undefined
    readonly mask?: boolean | undefined
    readonly maskChar?: string | undefined
    /** Default `"one-time-code"`. */
    readonly autocomplete?: string | undefined
    /** Submits the form once a user change completes the code (`requestSubmit`, no focus moves). */
    readonly autoSubmit?: boolean | undefined
    readonly enterkeyhint?:
      | "enter"
      | "done"
      | "go"
      | "next"
      | "previous"
      | "search"
      | "send"
      | undefined
    /** The id of the form the input belongs to. */
    readonly form?: string | undefined
    /** The consumer's direction; the code itself is always laid out left to right. Default: `"ltr"`. */
    readonly dir?: "ltr" | "rtl" | undefined
    readonly messages?: MessageOverrides<PinInputMessages> | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
    readonly children?: Snippet | undefined
  }
export type PinInputControlProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<PinInputState>]> | undefined
  readonly children?: Snippet<[PinInputState]> | undefined
}
export type PinInputInputProps = Omit<
  HTMLInputAttributes,
  "value" | "defaultValue" | "type" | "children"
> & {
  readonly child?: Snippet<[ChildArgs<PinInputState>]> | undefined
}
export type PinInputSlotState = PinInputState & { readonly char: string | undefined }
export type PinInputSlotProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The slot's position, from 0. */
  readonly index: number
  readonly child?: Snippet<[ChildArgs<PinInputSlotState>]> | undefined
  readonly children?: Snippet<[PinInputSlotState]> | undefined
}
