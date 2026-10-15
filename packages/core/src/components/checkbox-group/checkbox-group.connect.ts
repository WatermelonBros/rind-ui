// Checkbox Group parts (design §4) and the controlled props each item Checkbox and the
// Parent get from the group (design §2): items keep their own services, ids and labels.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { parentStateOf } from "./checkbox-group.machine"

export type CheckboxGroupPart = "root" | "label" | "description" | "error-message"

export interface CheckboxGroupConnectInput {
  readonly instance: string
  readonly value: readonly string[]
  readonly allValues: readonly string[]
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly name?: string | undefined
  readonly form?: string | undefined
  /** The Root's rendered tag (a `fieldset` named by its `legend` gets no role). */
  readonly rootTag: string
  readonly labelTag: string
  readonly ids: {
    readonly label: string
    readonly description: string
    readonly errorMessage: string
  }
  /** Rendered parts (only these are referenced). */
  readonly rendered: {
    readonly label?: string | undefined
    readonly description?: string | undefined
    readonly errorMessage?: string | undefined
  }
  /** The enclosing Field's ids (field-control), when the group is registered with one. */
  readonly field?: {
    readonly label?: string | undefined
    readonly description?: string | undefined
    readonly error?: string | undefined
  }
  /** Rendered item Control ids, in `allValues` order (the Parent's aria-controls). */
  readonly controls: readonly string[]
}

/** What an item Checkbox (or the Parent) takes from its group. */
export interface GroupedCheckbox {
  readonly checked: boolean | "indeterminate"
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  /** Submitted under the group's name (an item's own is ignored); the Parent: none. */
  readonly name: string | undefined
  readonly form: string | undefined
  /** The group's Description and ErrorMessage, added to the Control's aria-describedby. */
  readonly describedBy: string | undefined
  /** Extra Root / Control attributes (`data-value`, `data-parent`, `aria-controls`). */
  readonly root: PartProps
  readonly control: PartProps
}

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function checkboxGroupConnect(input: CheckboxGroupConnectInput) {
  const fieldset = input.rootTag === "fieldset" && input.labelTag === "legend"
  const requiredActive = input.required && input.value.length === 0
  const error = input.invalid ? input.rendered.errorMessage : undefined
  const flags = {
    "data-disabled": dataFlag(input.disabled),
    "data-invalid": dataFlag(input.invalid),
  }
  const describedBy = join(input.rendered.description, error)
  return {
    root: (): PartProps => ({
      ...scopeAttrs("checkbox-group", "root", input.instance),
      // A fieldset named by its legend needs neither (native group semantics).
      role: fieldset ? undefined : "group",
      "aria-labelledby": fieldset ? undefined : (input.field?.label ?? input.rendered.label),
      "aria-describedby": join(input.field?.description, input.field?.error, describedBy),
      ...flags,
      "data-readonly": dataFlag(input.readOnly),
      "data-required": dataFlag(input.required),
    }),
    label: (): PartProps => ({
      ...scopeAttrs("checkbox-group", "label", input.instance),
      id: input.ids.label,
      ...flags,
    }),
    description: (): PartProps => ({
      ...scopeAttrs("checkbox-group", "description", input.instance),
      id: input.ids.description,
      ...flags,
    }),
    errorMessage: (): PartProps => ({
      ...scopeAttrs("checkbox-group", "error-message", input.instance),
      id: input.ids.errorMessage,
      ...flags,
    }),
    /** An item's controlled props: membership, OR'ed flags, required while empty. */
    item: (
      value: string,
      own: { disabled: boolean; readOnly: boolean; required: boolean },
    ): GroupedCheckbox => ({
      checked: input.value.includes(value),
      disabled: input.disabled || own.disabled,
      readOnly: input.readOnly || own.readOnly,
      // Only enabled items carry the group's constraint (the first one fails validation).
      required: own.required || (requiredActive && !input.disabled && !own.disabled),
      invalid: input.invalid,
      name: input.name,
      form: input.form,
      describedBy,
      root: { "data-value": value },
      control: { "data-value": value },
    }),
    /** The Parent: derived state, never submitted, controls the rendered items. */
    parent: (): GroupedCheckbox => {
      const state = parentStateOf(input.value, input.allValues)
      return {
        checked: state === "indeterminate" ? "indeterminate" : state === "checked",
        disabled: input.disabled,
        readOnly: input.readOnly,
        required: false,
        invalid: false,
        name: undefined,
        form: input.form,
        describedBy,
        root: { "data-parent": "" },
        control: { "data-parent": "", "aria-controls": input.controls.join(" ") || undefined },
      }
    },
  }
}
