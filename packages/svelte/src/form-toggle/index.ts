import Control from "./form-toggle-control.svelte"
import Description from "./form-toggle-description.svelte"
import Indicator from "./form-toggle-indicator.svelte"
import Label from "./form-toggle-label.svelte"
import Root from "./form-toggle-root.svelte"

export { formToggleGrouping } from "./context.svelte"
export type {
  FormToggleConfig,
  FormToggleControlProps,
  FormToggleDescriptionProps,
  FormToggleGrouped,
  FormToggleGrouping,
  FormToggleIndicatorProps,
  FormToggleLabelProps,
  FormToggleRootProps,
  FormToggleState,
} from "./types"

/**
 * The parts Checkbox and Switch are built from, for a toggle of your own: pass your
 * `FormToggleConfig` (scope, role, service) to `FormToggle.Root` as `config`.
 */
export const FormToggle = { Root, Control, Indicator, Label, Description }
