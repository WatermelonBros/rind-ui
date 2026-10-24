import type { ChangeDetails, CheckboxEvent, CheckedState } from "@rind-ui/core"
import Control from "../form-toggle/form-toggle-control.svelte"
import Description from "../form-toggle/form-toggle-description.svelte"
import Indicator from "../form-toggle/form-toggle-indicator.svelte"
import Label from "../form-toggle/form-toggle-label.svelte"
import type { FormToggleRootProps, FormToggleState } from "../form-toggle/types"
import Root from "./checkbox-root.svelte"

export type CheckboxState = FormToggleState<CheckedState>
export type CheckboxRootProps = FormToggleRootProps<CheckedState, ChangeDetails<CheckboxEvent>>

/** A two- or three-state checkbox (APG Checkbox), on a button with role checkbox. */
export const Checkbox = { Root, Control, Indicator, Label, Description }
