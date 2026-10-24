/** @jsxImportSource solid-js */
import {
  type ChangeDetails,
  type SwitchEvent,
  switchMachine,
  switchMachineProps,
} from "@rind-ui/core"
import {
  createFormToggle,
  type FormToggleIndicatorProps,
  type FormToggleRootProps,
  type FormToggleState,
} from "../form-toggle/form-toggle"
import { useMachine } from "../use-machine"

export type SwitchState = FormToggleState<boolean>
export type SwitchRootProps = FormToggleRootProps<boolean, ChangeDetails<SwitchEvent>>
export type SwitchThumbProps = FormToggleIndicatorProps<boolean>

const parts = createFormToggle<boolean, ChangeDetails<SwitchEvent>>({
  scope: "switch",
  role: "switch",
  indicatorPart: "thumb",
  label: "Switch",
  useService: (props, formInput) => {
    const { view, send } = useMachine(switchMachine, () => switchMachineProps(props(), formInput), {
      formInput,
    })
    return {
      checked: () => view().values.checked === true,
      focused: () => view().context.focused,
      send,
    }
  },
})

/** An on/off switch (APG Switch), on a button with role switch. */
// A pure call around the object: reading `parts.Root` could run a getter as far as a bundler
// knows, so a plain object literal would stay in every bundle that reaches this module.
export const Switch = /* @__PURE__ */ (() => ({
  Root: parts.Root,
  Control: parts.Control,
  Thumb: parts.Indicator,
  Label: parts.Label,
  Description: parts.Description,
}))()
