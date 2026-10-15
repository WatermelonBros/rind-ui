// control-label: the Label and Description of a labelable rind-ui control (Checkbox, Switch,
// group items). A labelable control is named natively by `<label for>` (no aria-labelledby,
// so a consumer aria-label is never doubled: base-ui#5786); a non-labelable one (a `<div>`
// through `render`) by aria-labelledby, its Label pressing it instead (headlessui#3876).
// The label's pointer rules are label-interaction's (add-label); press.ts already turns the
// click a label forwards into one pointer press.

import { type PartProps, scopeAttrs } from "../../connect/props"

declare const process: { env: { NODE_ENV?: string } }

export interface ControlLabelInput {
  readonly scope: string
  readonly instance: string
  readonly controlId: string
  readonly labelId: string
  readonly descriptionId: string
  /** The rendered control element is labelable (a native button or input). */
  readonly labelable: boolean
  /** The control's state attributes, mirrored on Label and Description. */
  readonly state: Readonly<Record<`data-${string}`, string | undefined>>
}

export function controlLabel(input: ControlLabelInput) {
  return {
    label: (): PartProps => ({
      ...scopeAttrs(input.scope, "label", input.instance),
      id: input.labelId,
      htmlFor: input.labelable ? input.controlId : undefined,
      ...input.state,
    }),
    description: (): PartProps => ({
      ...scopeAttrs(input.scope, "description", input.instance),
      id: input.descriptionId,
      ...input.state,
    }),
  }
}

/** Development: an own Label inside a Field (the Field's Label names the control). */
export function warnOwnLabelInField(scope: string): void {
  if (process.env.NODE_ENV === "production") return
  console.warn(
    `[rind-ui] ${scope}: its own Label is inside a Field; the Field's Label names the control (remove one)`,
  )
}
