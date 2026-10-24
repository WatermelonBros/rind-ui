<script lang="ts">
import { DEV } from "../dev"
import Part from "../field/host-error-message.svelte"
import type { FieldErrorMessageProps } from "../field/types"
import { dateField, useDateRange } from "./context"

// A Label-like part: nothing inside an embedded field (its host names it). A range Root is the
// Field: its ErrorMessage is the Field's (no single-field context there).
const props: FieldErrorMessageProps = $props()
const single = dateField.maybe() ?? null
const range = useDateRange()
if (!single && !range) throw new Error("DateField.ErrorMessage must be inside DateField.Root")
const embedded = single?.embedded === true
$effect(() => {
  if (embedded && DEV)
    console.warn(
      "[rind-ui] date-field: an embedded field renders no ErrorMessage; the host names it.",
    )
})
</script>

{#if !embedded}<Part {...props} />{/if}
