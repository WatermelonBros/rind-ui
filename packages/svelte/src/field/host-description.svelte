<script lang="ts">
import { DEV } from "../dev"
import Part from "./field-description.svelte"
import { fieldHost } from "./host-context"
import type { FieldDescriptionProps } from "./types"

// A host's Description: the Field's when the host is the Field, else nothing (and a warning).
const props: FieldDescriptionProps = $props()
const { standalone, scope } = fieldHost.get()
$effect(() => {
  if (!standalone && DEV)
    console.warn(
      `[rind-ui] ${scope}: its Description is not rendered inside a Field; use the Field's Description.`,
    )
})
</script>

{#if standalone}<Part {...props} />{/if}
