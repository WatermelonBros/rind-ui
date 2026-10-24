<script lang="ts">
import { DEV } from "../dev"
import Part from "../field/host-description.svelte"
import type { FieldDescriptionProps } from "../field/types"
import { dateField, useDateRange } from "./context"

// A Label-like part: nothing inside an embedded field (its host names it). A range Root is the
// Field: its Description is the Field's (no single-field context there).
const props: FieldDescriptionProps = $props()
const single = dateField.maybe() ?? null
const range = useDateRange()
if (!single && !range) throw new Error("DateField.Description must be inside DateField.Root")
const embedded = single?.embedded === true
$effect(() => {
  if (embedded && DEV)
    console.warn(
      "[rind-ui] date-field: an embedded field renders no Description; the host names it.",
    )
})
</script>

{#if !embedded}<Part {...props} />{/if}
