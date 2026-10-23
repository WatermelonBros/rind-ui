<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timelineContext, timelineItem } from "./context"
import type { TimelinePartProps } from "./types"

const { child, children, ...rest }: TimelinePartProps = $props()
const ctx = timelineContext.get()
const item = timelineItem.get()
const text = $derived(ctx.api().statusText(item()))
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().title(item())), rest)))
const current = $derived({ ...ctx.state(), status: ctx.api().statusOf(item()) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}{#if text}<span {...attrs(normalizeProps(ctx.api().statusProps()))}
        >{text}</span
      >{/if}</div>
{/if}
