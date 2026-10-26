// The binding between a Field and the one rind-ui form control inside it (field-control).
// The control reads it in its Root, merges it with its own props here, registers once and
// reports its changes; it never decides validation timing (base-ui#1050).

import type { RegisteredControl, ValidationBehavior } from "../field/field.machine"

export interface FieldControlState {
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  /** The Field's DISPLAYED invalid state. */
  readonly invalid: boolean
  readonly validationBehavior: ValidationBehavior
}

export type FieldControlReport =
  | {
      readonly type: "change"
      readonly value: unknown
      readonly user: boolean
      readonly composing: boolean
    }
  | { readonly type: "commit" }

export interface FieldControlBinding {
  /** Ids of the Field parts that are rendered now. */
  readonly ids: {
    readonly label?: string | undefined
    readonly description?: string | undefined
    readonly error?: string | undefined
  }
  readonly state: FieldControlState
  /**
   * The Label is rendered as an element other than `<label>` (its `for` names nothing): a
   * labelable control is then named by `aria-labelledby` too (base-ui#587).
   */
  readonly labelNotNative?: boolean | undefined
  /** The validation data attributes the control's own root carries too. */
  readonly data: Readonly<Record<`data-${string}`, string | undefined>>
  readonly name?: string | undefined
  /** The id the control's focusable element takes unless it has its own (Label `for`). */
  readonly controlId: string
  readonly errorMessageAttribute: "describedby" | "both"
  /** Registers the control; returns the unregistration. A second control is refused. */
  register(control: RegisteredControl, label: string): () => void
  report(event: FieldControlReport): void
  /** One control per Field: the first token to claim wins (others warn and get none). */
  claim(token: string): boolean
  release(token: string): void
}

export interface FieldControlOwn {
  readonly role: string
  readonly labelable: boolean
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly name?: string | undefined
  /** The control's own description ids (its own Description part). */
  readonly describedBy?: string | undefined
  /** The consumer's `aria-describedby`, kept last. */
  readonly consumerDescribedBy?: string | undefined
  /** The consumer named the control itself: used as given. */
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
}

export interface FieldControlProps {
  readonly disabled: boolean
  readonly readOnly: boolean
  /** The native `required` attribute (native behaviour only). */
  readonly required: boolean
  readonly invalid: boolean
  readonly name: string | undefined
  readonly "aria-required": "true" | undefined
  readonly "aria-invalid": "true" | undefined
  readonly "aria-describedby": string | undefined
  readonly "aria-labelledby": string | undefined
  readonly "aria-errormessage": string | undefined
}

const join = (...ids: (string | undefined)[]) =>
  ids.filter((id): id is string => Boolean(id)).join(" ") || undefined

/**
 * The control's effective attributes: booleans OR'ed, describedby = Field description,
 * Field error (while rendered), own ids, consumer ids; never a dangling or empty id list
 * (ark#3824, react-spectrum#2330); the error never in the name (kobalte#534); no
 * `aria-invalid` on role button (react-spectrum#8382).
 */
export function mergeFieldProps(
  own: FieldControlOwn,
  binding: FieldControlBinding | null,
): FieldControlProps {
  const state = binding?.state
  const required = own.required === true || state?.required === true
  const native = (state?.validationBehavior ?? "native") === "native"
  const invalid = own.invalid === true || state?.invalid === true
  const ids = binding?.ids ?? {}
  const error = invalid ? ids.error : undefined
  const namedByConsumer = own.ariaLabel !== undefined || own.ariaLabelledBy !== undefined
  return {
    disabled: own.disabled === true || state?.disabled === true,
    readOnly: own.readOnly === true || state?.readOnly === true,
    required: required && native,
    invalid,
    name: own.name ?? binding?.name,
    "aria-required": required && !native ? "true" : undefined,
    "aria-invalid": invalid && own.role !== "button" ? "true" : undefined,
    "aria-describedby": join(ids.description, error, own.describedBy, own.consumerDescribedBy),
    "aria-labelledby":
      own.ariaLabelledBy ??
      (namedByConsumer || (own.labelable && binding?.labelNotNative !== true)
        ? undefined
        : ids.label),
    "aria-errormessage":
      binding?.errorMessageAttribute === "both" && invalid && own.role !== "button"
        ? error
        : undefined,
  }
}
