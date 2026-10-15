import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { ValidationBehavior } from "../field/field.machine"

export interface FormConnectInput {
  readonly instance: string
  readonly state: string
  readonly failed: boolean
  readonly validationBehavior: ValidationBehavior
}

/** The form root: `novalidate` only in `aria` behaviour (the Fields display instead). */
export function formConnect(input: FormConnectInput): PartProps {
  return {
    ...scopeAttrs("form", "root", input.instance),
    novalidate: input.validationBehavior === "aria" ? true : undefined,
    "data-validating": dataFlag(input.state === "validating"),
    "data-invalid": dataFlag(input.failed),
  }
}
