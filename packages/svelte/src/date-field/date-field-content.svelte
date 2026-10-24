<script lang="ts">
import { useFieldBindingPeek } from "../field/context.svelte"
import PopoverContent from "../popover/popover-content.svelte"
import { single, useDateRange } from "./context"
import type { DateFieldContentProps } from "./types"

// The popover's dialog, named by the trigger's name and the Label unless named otherwise.
const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...rest
}: DateFieldContentProps = $props()
const range = useDateRange()
const binding = useFieldBindingPeek()
const host = single.maybe() ?? null
const name = $derived.by(() => {
  if (label !== undefined || labelledBy !== undefined)
    return { "aria-label": label, "aria-labelledby": labelledBy }
  const own = range
    ? range.api(binding?.() ?? null).contentLabelledBy()
    : host?.api().contentLabelledBy()
  return { "aria-labelledby": own }
})
</script>

<PopoverContent {...rest as Record<string, unknown>} {...name} />
