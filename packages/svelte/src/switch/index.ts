import type { ChangeDetails, SwitchEvent } from "@rind-ui/core"
import Control from "../form-toggle/form-toggle-control.svelte"
import Description from "../form-toggle/form-toggle-description.svelte"
import Thumb from "../form-toggle/form-toggle-indicator.svelte"
import Label from "../form-toggle/form-toggle-label.svelte"
import type { FormToggleRootProps, FormToggleState } from "../form-toggle/types"
import Root from "./switch-root.svelte"

export type SwitchState = FormToggleState<boolean>
export type SwitchRootProps = FormToggleRootProps<boolean, ChangeDetails<SwitchEvent>>

/** An on/off switch (APG Switch), on a button with role switch. */
export const Switch = { Root, Control, Thumb, Label, Description }
