import type {
  FormErrors,
  FormMessages,
  FormSubmitDetails,
  MessageOverrides,
  ValidationBehavior,
  ValidationMode,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLFormAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    form: FormMessages
  }
}

/** What `bind:this` on the Root exposes. */
export interface FormActions {
  /** Validates every Field (or the one named): errors are displayed; nothing is focused. */
  validate(name?: string): void
}
export interface FormState {
  readonly invalid: boolean
  readonly validating: boolean
}
export type FormRootProps = Omit<HTMLFormAttributes, "children"> & {
  /** Default mode for the Fields inside. */
  readonly validationMode?: ValidationMode | undefined
  /** Default behaviour for the Fields inside; `aria` adds `novalidate`. */
  readonly validationBehavior?: ValidationBehavior | undefined
  /** Server errors by Field name (exact name: `items.0.name` matches as a string). */
  readonly errors?: FormErrors | undefined
  /** Replaces the native submission: typed values of every named Field. */
  readonly onFormSubmit?:
    | ((values: Readonly<Record<string, unknown>>, details: FormSubmitDetails) => void)
    | undefined
  readonly messages?: MessageOverrides<FormMessages> | undefined
  readonly child?: Snippet<[ChildArgs<FormState>]> | undefined
  readonly children?: Snippet<[FormState]> | undefined
}
