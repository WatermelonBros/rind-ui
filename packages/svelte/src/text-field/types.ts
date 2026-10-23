import type {
  FieldMessages,
  MessageOverrides,
  TextFieldDetails,
  TextFieldMessages,
  TextFieldSubmitDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLTextareaAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"
import type { FieldOwnProps } from "../field/types"

declare module "../provider" {
  interface RindMessageScopes {
    "text-field": TextFieldMessages
  }
}

export type TextFieldVisibilityReason = "PRESS" | "SUBMIT" | "RESET"
export interface TextFieldVisibilityDetails {
  readonly reason: TextFieldVisibilityReason
}
export type { TextFieldDetails }

export type TextFieldRootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  keyof FieldOwnProps | "children" | "onsubmit"
> &
  Omit<FieldOwnProps, "messages"> & {
    readonly children?: Snippet | undefined
    /**
     * The Input's native type. `"password"`: the visibility parts and rules (hidden on submit
     * and reset, caret kept, privacy attributes); `"search"`: a searchbox, "Clear search",
     * Escape clears.
     */
    readonly type?: string | undefined
    /** `type="password"`: visibility; `bind:visible` controls it. */
    visible?: boolean | undefined
    readonly defaultVisible?: boolean | undefined
    readonly onVisibleChange?:
      | ((visible: boolean, details: TextFieldVisibilityDetails) => void)
      | undefined
    /** Escape clears a non-empty editable value (default: true for `type="search"`). */
    readonly escapeClears?: boolean | undefined
    /** Enter (not composing). The form still submits unless `details.event` is prevented. */
    readonly onSubmit?: ((value: string, details: TextFieldSubmitDetails) => void) | undefined
    /** The value; `bind:value` controls it. */
    value?: string | null | undefined
    readonly defaultValue?: string | undefined
    readonly onValueChange?: ((value: string, details: TextFieldDetails) => void) | undefined
    /** Disabled but focusable: read-only + aria-disabled; nothing changes the value. */
    readonly focusableWhenDisabled?: boolean | undefined
    /** Announce the count when this many or fewer characters remain. */
    readonly countThreshold?: number | undefined
    readonly messages?: MessageOverrides<TextFieldMessages> | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
  }

type ControlChild = { readonly child?: Snippet<[ChildArgs<{ composing: boolean }>]> | undefined }
export type TextFieldInputProps = Omit<HTMLInputAttributes, "value" | "children"> & ControlChild
export type TextFieldTextareaProps = Omit<HTMLTextareaAttributes, "value" | "children"> &
  ControlChild & {
    /** Grows with its content. */
    readonly autosize?: boolean | undefined
  }
export type TextFieldClearTriggerProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type TextFieldCharacterCountProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** A soft limit: going over it is a `tooLong`-style error, never a truncation. */
  readonly max?: number | undefined
  /** Replaces the counter (default: UTF-16 code units, a line break counts once). */
  readonly count?: ((value: string) => number) | undefined
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
}
export type TextFieldVisibilityTriggerProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<{ visible: boolean }>]> | undefined
  readonly children?: Snippet<[{ visible: boolean }]> | undefined
}
export type TextFieldVisibilityIndicatorProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  readonly child?: Snippet<[ChildArgs<{ visible: boolean }>]> | undefined
  /** The icon; style it by `data-state` (`aria-hidden`). */
  readonly children?: Snippet<[{ visible: boolean }]> | undefined
}
