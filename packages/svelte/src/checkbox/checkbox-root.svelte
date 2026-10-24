<script lang="ts">
import type { ChangeDetails, CheckboxEvent, CheckedState } from "@rind-ui/core"
import FormToggleRoot from "../form-toggle/form-toggle-root.svelte"
import type { FormToggleRootProps } from "../form-toggle/types"
import { checkboxConfig } from "./config.svelte"

// A two- or three-state checkbox (APG Checkbox), on a button with role checkbox.
let {
  checked = $bindable(),
  ...props
}: FormToggleRootProps<CheckedState, ChangeDetails<CheckboxEvent>> = $props()
</script>

<FormToggleRoot config={checkboxConfig} bind:checked {...props as FormToggleRootProps<CheckedState, unknown>} />
