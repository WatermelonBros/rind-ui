<script lang="ts">
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import PopoverTrigger from "../popover/popover-trigger.svelte"
import { single, useDateRange } from "./context"
import type { DateFieldTriggerProps } from "./types"

// Opens the popover; counted so Alt+ArrowDown opens only a picker.
const { child, children, ...rest }: DateFieldTriggerProps = $props()
const range = useDateRange()
const binding = useFieldBindingPeek()
const host = single.maybe() ?? null
const count = range?.triggers ?? host?.ctx.picker.triggers ?? null
// Untracked: the count is written here, never read.
$effect(() => {
  if (!count) return
  untrack(() => count.count++)
  return () => untrack(() => count.count--)
})
const own = $derived(
  range ? range.api(binding?.() ?? null).trigger({ range: true }) : (host?.api().trigger() ?? {}),
)
const merged = $derived(mergeProps(normalizeProps(own), rest as Record<string, unknown>))
</script>

<!-- Sound: the trigger's child receives the popover's open state (a superset). -->
<PopoverTrigger {...merged} child={child as never} {children} />
