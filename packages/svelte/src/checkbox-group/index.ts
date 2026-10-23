import { Checkbox } from "../checkbox"
import Description from "./checkbox-group-description.svelte"
import ErrorMessage from "./checkbox-group-error-message.svelte"
import Label from "./checkbox-group-label.svelte"
import Parent from "./checkbox-group-parent.svelte"
import Root from "./checkbox-group-root.svelte"

export type { CheckboxGroupPartProps, CheckboxGroupRootProps, CheckboxGroupState } from "./types"

/**
 * A group of checkboxes with one value: Items join it, a Parent selects them all. An Item
 * alone is a single checkbox.
 */
export const CheckboxGroup = {
  Root,
  Label,
  Description,
  ErrorMessage,
  Parent,
  Item: Checkbox.Root,
  ItemControl: Checkbox.Control,
  ItemIndicator: Checkbox.Indicator,
  ItemLabel: Checkbox.Label,
  ItemDescription: Checkbox.Description,
}
