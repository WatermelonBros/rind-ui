<script lang="ts">
import { DEV } from "../dev"
import Part from "./field-label.svelte"
import { fieldHost } from "./host-context"
import type { FieldLabelProps } from "./types"

// A host's Label: the Field's when the host is the Field, else nothing (and a warning).
const props: FieldLabelProps = $props()
const { standalone, scope } = fieldHost.get()
$effect(() => {
  if (!standalone && DEV)
    console.warn(
      `[rind-ui] ${scope}: its Label is not rendered inside a Field; use the Field's Label.`,
    )
})
</script>

{#if standalone}<Part {...props} />{/if}
