// Checkbox (design §2): three flat states bound to one controllable `checked`
// (boolean | "indeterminate"), so the graph has every edge the model tests walk and a user
// action never produces "indeterminate". The hidden input is reached only through the
// injected `formInput` capability.

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { FormInputCapability } from "../../dom/hidden-input"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type CheckedState = boolean | "indeterminate"

export type CheckboxEvent =
  /** A press on the Control (or on the Label in the non-labelable fallback). */
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  /** The form's reset: restores the current `defaultChecked` prop. */
  | { readonly type: "RESET" }
  | FocusEvent
  | BlurEvent

export interface CheckboxProps {
  readonly checked?: CheckedState | undefined
  /** Read at creation; later changes only change what a form reset restores. */
  readonly defaultChecked?: CheckedState | undefined
  readonly onCheckedChange?:
    | ((checked: CheckedState, details: ChangeDetails<CheckboxEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface CheckboxEnv {
  /** Absent where there is no DOM (a model test's oracle): nothing to mirror. */
  readonly formInput?: FormInputCapability | undefined
}

export const checkboxMachine = /* @__PURE__ */ setup({
  types: type<{
    props: CheckboxProps
    events: CheckboxEvent
    env: CheckboxEnv
    context: { focused: boolean; pendingUserValue: CheckedState | null }
    values: "checked"
  }>(),
  guards: {
    canToggle: ({ props }) => props.disabled !== true && props.readOnly !== true,
    // The CURRENT defaultChecked prop (react-spectrum#6830, radix#4155), not the creation one.
    defaultIsChecked: ({ props }) => props.defaultChecked === true,
    defaultIsIndeterminate: ({ props }) => props.defaultChecked === "indeterminate",
  },
  actions: {
    // The user's next value, per edge: transition actions see the committed value when
    // uncontrolled but the old one for a controlled proposal, so the target is named here.
    recordUserChecked: ({ set }) => set("pendingUserValue", true),
    recordUserUnchecked: ({ set }) => set("pendingUserValue", false),
    /**
     * Mirrors the value on the hidden input; a user change (the pending value arrived)
     * dispatches input + change, a programmatic one (initial, parent, reset) none.
     */
    syncHiddenInput: ({ values, context, env, set }) => {
      const v = values.checked ?? false
      const dispatch = context.pendingUserValue !== null && context.pendingUserValue === v
      env.formInput?.sync(
        { checked: v === true, indeterminate: v === "indeterminate" },
        { dispatch },
      )
      // Arrived, or superseded by another value (a group applying something else): either
      // way the proposal is over, so a later parent change stays silent.
      if (context.pendingUserValue !== null) set("pendingUserValue", null)
    },
    /** A refused or cancelled change: forget it, and put the input back. */
    revert: ({ values, env, set }) => {
      set("pendingUserValue", null)
      const v = values.checked ?? false
      env.formInput?.sync(
        { checked: v === true, indeterminate: v === "indeterminate" },
        { dispatch: false },
      )
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "checkbox",
  initial: "unchecked",
  context: () => ({ focused: false, pendingUserValue: null }),
  values: {
    checked: {
      fallback: false,
      states: { unchecked: false, checked: true, indeterminate: "indeterminate" },
    },
  },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    RESET: [
      { guard: "defaultIsChecked", target: "checked" },
      { guard: "defaultIsIndeterminate", target: "indeterminate" },
      { target: "unchecked" },
    ],
    $reverted: { actions: ["revert"] },
  },
  states: {
    unchecked: {
      entry: ["syncHiddenInput"],
      on: { TOGGLE: { guard: "canToggle", target: "checked", actions: ["recordUserChecked"] } },
    },
    checked: {
      entry: ["syncHiddenInput"],
      on: { TOGGLE: { guard: "canToggle", target: "unchecked", actions: ["recordUserUnchecked"] } },
    },
    indeterminate: {
      entry: ["syncHiddenInput"],
      on: { TOGGLE: { guard: "canToggle", target: "checked", actions: ["recordUserChecked"] } },
    },
  },
})

export type CheckboxMachine = typeof checkboxMachine

/**
 * The machine props with the hidden input already reflecting an uncontrolled change when
 * `onCheckedChange` runs (headlessui#3760: a consumer calling `form.requestSubmit()` there).
 * The runtime calls the callback before the transition, so the input is written first; a
 * cancel reverts it ($reverted). Shared by Checkbox and Switch.
 */
export function syncInputBeforeChange<
  V extends CheckedState,
  P extends {
    readonly checked?: V | undefined
    readonly onCheckedChange?: ((checked: V, details: never) => void) | undefined
  },
>(props: P, formInput: FormInputCapability): P {
  const consumer = props.onCheckedChange as ((checked: V, details: unknown) => void) | undefined // the details pass through untouched
  if (props.checked !== undefined) return props
  return {
    ...props,
    onCheckedChange: (checked: V, details: unknown) => {
      formInput.sync(
        { checked: checked === true, indeterminate: checked === "indeterminate" },
        { dispatch: false },
      )
      consumer?.(checked, details)
    },
  }
}

/** Checkbox's machine props (see `syncInputBeforeChange`). */
export const checkboxMachineProps = (props: CheckboxProps, formInput: FormInputCapability) =>
  syncInputBeforeChange<CheckedState, CheckboxProps>(props, formInput)
