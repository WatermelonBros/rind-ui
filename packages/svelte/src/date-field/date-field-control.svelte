<script lang="ts">
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import PopoverAnchor from "../popover/popover-anchor.svelte"
import { inControl, single, useDateRange } from "./context"
import type { DateFieldControlProps } from "./types"

// The group around the Input and the triggers; the popover is placed against it.
const { child, children, ...rest }: DateFieldControlProps = $props()
const range = useDateRange()
const host = single.maybe() ?? null
// Range: the pair's group is the Input itself; the Control only anchors and holds triggers.
inControl.set(!range)
const own = $derived.by(() => {
  const { id: _id, ...p } = (range ? {} : normalizeProps(host?.api().control() ?? {})) as Record<
    string,
    unknown
  >
  return p
})
const merged = $derived(mergeProps(own, rest as Record<string, unknown>))
</script>

<PopoverAnchor {...merged} {child} {children} />
