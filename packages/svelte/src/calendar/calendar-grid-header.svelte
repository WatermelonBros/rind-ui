<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { calendarHost } from "./context"
import type { CalendarGridHeaderProps } from "./types"

const { child, children, ...rest }: CalendarGridHeaderProps = $props()
const ctx = calendarHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().gridHeader()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <thead {...attrs(merged)}>{@render children?.()}</thead>
{/if}
