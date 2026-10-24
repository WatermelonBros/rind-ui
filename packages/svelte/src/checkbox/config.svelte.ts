import { checkboxMachine, checkboxMachineProps } from "@rind-ui/core"
import type { FormToggleConfig } from "../form-toggle/types"
import { useMachine } from "../use-machine.svelte"

export const checkboxConfig: FormToggleConfig = {
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
    // The shared Root proposes CheckedState and the machine's ChangeDetails.
    const machine = useMachine(
      checkboxMachine,
      () => checkboxMachineProps(props() as never, formInput),
      { formInput },
    )
    return {
      checked: () => machine.view.values.checked ?? false,
      focused: () => machine.view.context.focused,
      send: machine.send,
    }
  },
}
