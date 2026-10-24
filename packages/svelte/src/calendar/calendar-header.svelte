<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { calendarHost } from "./context"
import type { CalendarHeaderProps } from "./types"

const { child, children, ...rest }: CalendarHeaderProps = $props()
const ctx = calendarHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().header()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
