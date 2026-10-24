<script lang="ts">
import { DEV } from "../dev"
import Part from "./field-error-message.svelte"
import { fieldHost } from "./host-context"
import type { FieldErrorMessageProps } from "./types"

// A host's ErrorMessage: the Field's when the host is the Field, else nothing (and a warning).
const props: FieldErrorMessageProps = $props()
const { standalone, scope } = fieldHost.get()
$effect(() => {
  if (!standalone && DEV)
    console.warn(
      `[rind-ui] ${scope}: its ErrorMessage is not rendered inside a Field; use the Field's ErrorMessage.`,
    )
})
</script>

{#if standalone}<Part {...props} />{/if}
