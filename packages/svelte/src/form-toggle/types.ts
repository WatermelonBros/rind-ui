import type {
  BlurEvent,
  CheckedState,
  FocusEvent,
  FormInputCapability,
  GroupedCheckbox,
  Modality,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface FormToggleState<V extends CheckedState = CheckedState> {
  readonly checked: V
  readonly disabled: boolean
  readonly readOnly: boolean
}

/** The events a form toggle's machine takes from its parts. */
export type FormToggleEvent =
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  | { readonly type: "RESET" }
  | FocusEvent
  | BlurEvent

/** What the shared parts read from a component's machine (getters). */
export interface FormToggleService {
  readonly checked: () => CheckedState
  readonly focused: () => boolean
  send(event: FormToggleEvent): void
}

/** The machine props a component's `useService` receives. */
export interface FormToggleServiceProps<V extends CheckedState, D> {
  readonly checked: V | undefined
  readonly defaultChecked: V
  readonly onCheckedChange: (checked: V, details: D) => void
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface FormToggleConfig {
  readonly scope: "checkbox" | "switch"
  readonly role: "checkbox" | "switch"
  /** The decorative part ("indicator", or the Switch's "thumb"). */
  readonly indicatorPart: "indicator" | "thumb"
  /** Names the component in errors ("Checkbox", "Switch"). */
  readonly label: string
  /** Public part names for guard messages (default `<label>.<Part>`). */
  readonly partNames?: Partial<
    Record<"Root" | "Control" | "Indicator" | "Label" | "Description", string>
  >
  /** The component's own machine (useMachine), during initialisation. */
  readonly useService: (
    props: () => FormToggleServiceProps<CheckedState, unknown>,
    formInput: FormInputCapability,
  ) => FormToggleService
}

/** How a Checkbox Group (or its select-all Parent) drives a Checkbox inside it. */
export interface FormToggleGrouping {
  resolve(
    value: string,
    own: { readonly disabled: boolean; readonly readOnly: boolean; readonly required: boolean },
  ): FormToggleGrouped | null
}

export interface FormToggleGrouped {
  readonly props: GroupedCheckbox
  /** The user's proposal: the group decides. */
  onChange(checked: CheckedState, modality: Modality): void
  /** The rendered Control's id and disabled flag; returns the unregistration. */
  register?(controlId: string, disabled: boolean): () => void
}

type Part<A, V extends CheckedState> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<FormToggleState<V>>]> | undefined
  readonly children?: Snippet<[FormToggleState<V>]> | undefined
}

export type FormToggleRootProps<V extends CheckedState, D> = Part<
  Omit<HTMLAttributes<HTMLDivElement>, "defaultChecked">,
  V
> & {
  /** The value; `bind:checked` controls it. */
  checked?: V | undefined
  /** Read at creation; a later change only changes what a form reset restores. */
  readonly defaultChecked?: V | undefined
  /** Every user-caused change (toggle or form reset); never called for a parent change. */
  readonly onCheckedChange?: ((checked: V, details: D) => void) | undefined
  /** Ignores activation. In a Checkbox Group the group's `disabled` also applies. */
  readonly disabled?: boolean | undefined
  /** Disabled but still in the Tab order (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Keeps focus and value, ignores activation. */
  readonly readonly?: boolean | undefined
  /** Must be checked to submit. A Checkbox Group Parent is never required. */
  readonly required?: boolean | undefined
  /** Marks the toggle invalid (`aria-invalid`, `data-invalid`). */
  readonly invalid?: boolean | undefined
  /** The submitted field name; ignored in a Checkbox Group (the group's `name` applies). */
  readonly name?: string | undefined
  /** Submitted while checked (default "on"). */
  readonly value?: string | undefined
  /** The id of the form the hidden input belongs to. */
  readonly form?: string | undefined
  /** Submitted while unchecked (and enabled); unchecked submits nothing without it. */
  readonly uncheckedValue?: string | undefined
}
export type FormToggleControlProps<V extends CheckedState = CheckedState> = Part<
  HTMLButtonAttributes,
  V
>
export type FormToggleLabelProps<V extends CheckedState = CheckedState> = Part<
  HTMLLabelAttributes,
  V
>
export type FormToggleDescriptionProps<V extends CheckedState = CheckedState> = Part<
  HTMLAttributes<HTMLDivElement>,
  V
>
export type FormToggleIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<{ checked: boolean; indeterminate: boolean }>]> | undefined
  /** Content, given the state (draw a check or a dash). */
  readonly children?: Snippet<[{ checked: boolean; indeterminate: boolean }]> | undefined
}
