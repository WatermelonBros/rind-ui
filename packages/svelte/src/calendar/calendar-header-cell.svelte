<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { calendarHost } from "./context"
import type { CalendarHeaderCellProps } from "./types"

const { day, child, children, ...rest }: CalendarHeaderCellProps = $props()
const ctx = calendarHost.get()
const own = $derived(ctx.api().headerCell(day))
const merged = $derived(stripMarker(mergeProps(normalizeProps(own), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <th {...attrs(merged)}>{#if children}{@render children()}{:else}{own["children"] as string}{/if}</th>
{/if}
