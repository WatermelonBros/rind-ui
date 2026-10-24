import { switchMachine, switchMachineProps } from "@rind-ui/core"
import type { FormToggleConfig } from "../form-toggle/types"
import { useMachine } from "../use-machine.svelte"

export const switchConfig: FormToggleConfig = {
  scope: "switch",
  role: "switch",
  indicatorPart: "thumb",
  label: "Switch",
  useService: (props, formInput) => {
    // The shared Root proposes CheckedState; a Switch only ever holds a boolean.
    const machine = useMachine(
      switchMachine,
      () => switchMachineProps(props() as never, formInput),
      { formInput },
    )
    return {
      checked: () => machine.view.values.checked === true,
      focused: () => machine.view.context.focused,
      send: machine.send,
    }
  },
}
