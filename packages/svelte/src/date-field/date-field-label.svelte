<script lang="ts">
import { DEV } from "../dev"
import Part from "../field/host-label.svelte"
import type { FieldLabelProps } from "../field/types"
import { dateField, useDateRange } from "./context"

// A Label-like part: nothing inside an embedded field (its host names it). A range Root is the
// Field: its Label is the Field's (no single-field context there).
const props: FieldLabelProps = $props()
const single = dateField.maybe() ?? null
const range = useDateRange()
if (!single && !range) throw new Error("DateField.Label must be inside DateField.Root")
const embedded = single?.embedded === true
$effect(() => {
  if (embedded && DEV)
    console.warn("[rind-ui] date-field: an embedded field renders no Label; the host names it.")
})
</script>

{#if !embedded}<Part {...props} />{/if}
