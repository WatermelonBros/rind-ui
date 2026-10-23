<script lang="ts">
import type { TimelineItemInput } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timelineContext, timelineItem } from "./context"
import type { TimelineItemProps } from "./types"

const { index, status, child, children, ...rest }: TimelineItemProps = $props()
const ctx = timelineContext.get()
// After mount, as React (the count is known once the items registered).
$effect(() => {
  const i = index
  return untrack(() => ctx.register(i))
})
const item: TimelineItemInput = $derived({ index, status })
timelineItem.set(() => item)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(item)), rest)))
const current = $derived({ ...ctx.state(), status: ctx.api().statusOf(item) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <li {...attrs(merged)}>{@render children?.(current)}</li>
{/if}
