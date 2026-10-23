<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timelineContext, timelineItem } from "./context"
import type { TimelinePartProps } from "./types"

/** An Item part: its props from connect, its status in the snippet state. */
const {
  part,
  child,
  children,
  ...rest
}: TimelinePartProps & {
  readonly part: "indicator" | "connector" | "content" | "description" | "opposite"
} = $props()
const ctx = timelineContext.get()
const item = timelineItem.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api()[part](item())), rest)))
const current = $derived({ ...ctx.state(), status: ctx.api().statusOf(item()) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
