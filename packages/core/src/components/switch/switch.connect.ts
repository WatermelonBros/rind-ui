// Switch parts: Checkbox's connect with role switch, scope switch and a Thumb in place of
// the Indicator (design "Connect"); the value is boolean, so aria-checked is never "mixed".

import type { LinkEnv } from "../../dom/link"
import { type CheckboxConnectInput, checkboxConnect } from "../checkbox/checkbox.connect"

export type SwitchPart = "root" | "control" | "thumb" | "label" | "description" | "hidden-input"

export type SwitchConnectInput = Omit<
  CheckboxConnectInput,
  "scope" | "role" | "indicatorPart" | "checked" | "defaultChecked"
> & {
  readonly checked: boolean
  readonly defaultChecked: boolean
}

export function switchConnect(input: SwitchConnectInput, env: LinkEnv) {
  const api = checkboxConnect(
    { ...input, scope: "switch", role: "switch", indicatorPart: "thumb" },
    env,
  )
  return { ...api, thumb: api.indicator }
}
