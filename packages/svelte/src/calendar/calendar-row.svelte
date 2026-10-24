<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { calendarHost } from "./context"
import type { CalendarRowProps } from "./types"

const { child, children, ...rest }: CalendarRowProps = $props()
const ctx = calendarHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().row()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <tr {...attrs(merged)}>{@render children?.()}</tr>
{/if}
