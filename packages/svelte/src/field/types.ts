import type {
  FieldMessages,
  MessageOverrides,
  Validate,
  ValidationBehavior,
  ValidationMode,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    field: FieldMessages
  }
}

export interface FieldState {
  readonly valid: boolean
  readonly invalid: boolean
  readonly validating: boolean
}

/** The Field's own props, shared with the Field hosts (Text Field, …). */
export interface FieldOwnProps {
  readonly name?: string | undefined
  readonly disabled?: boolean | undefined
  readonly readonly?: boolean | undefined
  readonly required?: boolean | undefined
  /** `true` forces invalid, `false` forces valid, `undefined` validates. */
  readonly invalid?: boolean | undefined
  /** Controlled flags. */
  readonly touched?: boolean | undefined
  readonly dirty?: boolean | undefined
  /** External errors (server errors): shown at once, cleared by the next change. */
  readonly errors?: readonly string[] | undefined
  readonly validate?: Validate | undefined
  /** Default "submit". */
  readonly validationMode?: ValidationMode | undefined
  /** Default "native". */
  readonly validationBehavior?: ValidationBehavior | undefined
  readonly validationDebounce?: number | undefined
  /** "both" adds `aria-errormessage` to `aria-describedby`. */
  readonly errorMessageAttribute?: "describedby" | "both" | undefined
  readonly messages?: MessageOverrides<FieldMessages> | undefined
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<FieldState>]> | undefined
  readonly children?: Snippet<[FieldState]> | undefined
}

export type FieldRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, keyof FieldOwnProps>> &
  FieldOwnProps & {
    /** For Field hosts: the scope the Field's parts carry. Default `field`. */
    readonly scope?: string | undefined
    /** For a Field host that is another component's part: its root's part name. */
    readonly rootPart?: string | undefined
  }
export type FieldLabelProps = Part<HTMLLabelAttributes>
export type FieldDescriptionProps = Part<HTMLAttributes<HTMLParagraphElement>>
export type FieldErrorMessageProps = Omit<HTMLAttributes<HTMLParagraphElement>, "children"> & {
  /** Rendered only when this validity key caused the error (one message per constraint). */
  readonly match?: string | undefined
  readonly child?: Snippet<[ChildArgs<FieldState>]> | undefined
  /** Replaces the default text; receives the messages. */
  readonly children?: Snippet<[readonly string[]]> | undefined
}
