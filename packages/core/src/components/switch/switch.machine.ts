// Switch (design "Machine"): Checkbox's two-valued sibling — states unchecked/checked bound
// to a boolean controllable `checked`, no mixed state. The hidden input is reached only
// through the injected `formInput` capability, with the same user-change rule.

import type { BlurEvent, FocusEvent } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { FormInputCapability } from "../../dom/hidden-input"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { syncInputBeforeChange } from "../checkbox/checkbox.machine"

export type SwitchEvent =
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  | { readonly type: "RESET" }
  | FocusEvent
  | BlurEvent

export interface SwitchProps {
  readonly checked?: boolean | undefined
  /** Read at creation; later changes only change what a form reset restores. */
  readonly defaultChecked?: boolean | undefined
  readonly onCheckedChange?:
    | ((checked: boolean, details: ChangeDetails<SwitchEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface SwitchEnv {
  /** Absent where there is no DOM (a model test's oracle): nothing to mirror. */
  readonly formInput?: FormInputCapability | undefined
}

export const switchMachine = setup({
  types: type<{
    props: SwitchProps
    events: SwitchEvent
    env: SwitchEnv
    context: { focused: boolean; pendingUserValue: boolean | null }
    values: "checked"
  }>(),
  guards: {
    canToggle: ({ props }) => props.disabled !== true && props.readOnly !== true,
    // The CURRENT defaultChecked prop (react-spectrum#6830, radix#4155).
    defaultIsChecked: ({ props }) => props.defaultChecked === true,
  },
  actions: {
    // Per edge: a controlled proposal's actions see the old value, a committed one the new.
    recordUserChecked: ({ set }) => set("pendingUserValue", true),
    recordUserUnchecked: ({ set }) => set("pendingUserValue", false),
    /** A user change (the pending value arrived) dispatches input + change; others none. */
    syncHiddenInput: ({ values, context, env, set }) => {
      const v = values.checked === true
      const dispatch = context.pendingUserValue === v
      env.formInput?.sync({ checked: v, indeterminate: false }, { dispatch })
      // Arrived, or superseded by another value (a group applying something else): either
      // way the proposal is over, so a later parent change stays silent.
      if (context.pendingUserValue !== null) set("pendingUserValue", null)
    },
    /** A refused or cancelled change: forget it, and put the input back. */
    revert: ({ values, env, set }) => {
      set("pendingUserValue", null)
      env.formInput?.sync(
        { checked: values.checked === true, indeterminate: false },
        { dispatch: false },
      )
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "switch",
  initial: "unchecked",
  context: () => ({ focused: false, pendingUserValue: null }),
  values: { checked: { fallback: false, states: { unchecked: false, checked: true } } },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused"] },
    RESET: [{ guard: "defaultIsChecked", target: "checked" }, { target: "unchecked" }],
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
  },
})

export type SwitchMachine = typeof switchMachine

/** Switch's machine props: the hidden input reflects an uncontrolled change first. */
export const switchMachineProps = (props: SwitchProps, formInput: FormInputCapability) =>
  syncInputBeforeChange<boolean, SwitchProps>(props, formInput)
