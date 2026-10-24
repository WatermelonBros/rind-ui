<script lang="ts">
import type { ChangeDetails, CheckedState, SwitchEvent } from "@rind-ui/core"
import FormToggleRoot from "../form-toggle/form-toggle-root.svelte"
import type { FormToggleRootProps } from "../form-toggle/types"
import { switchConfig } from "./config.svelte"

// An on/off switch (APG Switch), on a button with role switch.
let {
  checked = $bindable(),
  ...props
}: FormToggleRootProps<boolean, ChangeDetails<SwitchEvent>> = $props()
</script>

<FormToggleRoot config={switchConfig} bind:checked {...props as FormToggleRootProps<CheckedState, unknown>} />
