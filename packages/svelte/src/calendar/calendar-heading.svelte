<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import ViewTrigger from "./calendar-view-trigger.svelte"
import { calendarHost } from "./context"
import type { CalendarHeadingProps } from "./types"

const { child, children, ...rest }: CalendarHeadingProps = $props()
const ctx = calendarHost.get()
const drill = $derived(ctx.api().viewTrigger() !== null && ctx.api().viewTrigger() !== undefined)
const own = $derived(ctx.api().heading())
const merged = $derived(stripMarker(mergeProps(normalizeProps(own), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <h2 {...attrs(merged)}
    >{#if drill}<ViewTrigger />{:else if children}{@render children()}{:else}{own["children"] as string}{/if}</h2
  >
{/if}
