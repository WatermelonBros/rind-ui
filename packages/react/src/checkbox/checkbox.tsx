import {
  type ChangeDetails,
  type CheckboxEvent,
  type CheckedState,
  checkboxMachine,
  checkboxMachineProps,
} from "@rind-ui/core"
import {
  createFormToggle,
  type FormToggleIndicatorProps,
  type FormToggleRootProps,
  type FormToggleState,
} from "../form-toggle/form-toggle"
import { useMachine } from "../use-machine"

export type CheckboxState = FormToggleState<CheckedState>
export type CheckboxRootProps = FormToggleRootProps<CheckedState, ChangeDetails<CheckboxEvent>>
export type CheckboxIndicatorProps = FormToggleIndicatorProps<CheckedState>

/** A two- or three-state checkbox (APG Checkbox), on a button with role checkbox. */
export const Checkbox = createFormToggle<CheckedState, ChangeDetails<CheckboxEvent>>({
  scope: "checkbox",
  role: "checkbox",
  indicatorPart: "indicator",
  label: "Checkbox",
  useService: (props, formInput) => {
    const { view, send } = useMachine(checkboxMachine, checkboxMachineProps(props, formInput), {
      formInput,
    })
    return { checked: view.values.checked ?? false, focused: view.context.focused, send }
  },
})
