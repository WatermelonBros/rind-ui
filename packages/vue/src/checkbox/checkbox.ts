import {
  type ChangeDetails,
  type CheckboxEvent,
  type CheckedState,
  checkboxMachine,
  checkboxMachineProps,
} from "@rind-ui/core"
import { createFormToggle, type FormToggleState } from "../form-toggle/form-toggle"
import { useMachine } from "../use-machine"

export type CheckboxState = FormToggleState<CheckedState>

/** A two- or three-state checkbox (APG Checkbox), on a button with role checkbox. */
export const Checkbox = createFormToggle<CheckedState, ChangeDetails<CheckboxEvent>>({
  scope: "checkbox",
  role: "checkbox",
  indicatorPart: "indicator",
  label: "Checkbox",
  partNames: {
    Root: "CheckboxGroup.Item",
    Control: "CheckboxGroup.ItemControl",
    Indicator: "CheckboxGroup.ItemIndicator",
    Label: "CheckboxGroup.ItemLabel",
    Description: "CheckboxGroup.ItemDescription",
  },
  useService: (props, formInput) => {
    const { view, send } = useMachine(
      checkboxMachine,
      () => checkboxMachineProps(props(), formInput),
      { formInput },
    )
    return {
      checked: () => view.value.values.checked ?? false,
      focused: () => view.value.context.focused,
      send,
    }
  },
})
