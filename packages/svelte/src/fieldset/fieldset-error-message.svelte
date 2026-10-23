<script lang="ts">
import Shown from "./fieldset-error-message-shown.svelte"
import { fieldsetParts } from "./parts-context"
import type { FieldsetErrorMessageProps } from "./types"

// Rendered while the Fieldset is invalid (or with `forceMount`): only then it registers.
const props: FieldsetErrorMessageProps = $props()
const ctx = fieldsetParts.get()
</script>

{#if ctx.invalid() || props.forceMount}
  <Shown {...props} />
{/if}
