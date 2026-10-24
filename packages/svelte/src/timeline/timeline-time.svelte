<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timelineContext } from "./context"
import type { TimelineTimeProps } from "./types"

const { datetime, child, children, ...rest }: TimelineTimeProps = $props()
const ctx = timelineContext.get()
const date = $derived(typeof datetime === "string" ? new Date(datetime) : datetime)
const iso = $derived(typeof datetime === "string" ? datetime : datetime.toISOString())
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().time(iso)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <time {...attrs(merged)}
    >{#if children}{@render children(ctx.state())}{:else}{new Intl.DateTimeFormat(ctx.locale(), { dateStyle: "medium" }).format(
        date,
      )}{/if}</time
  >
{/if}
