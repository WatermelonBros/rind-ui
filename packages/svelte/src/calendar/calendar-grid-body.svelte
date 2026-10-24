<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { calendarHost } from "./context"
import type { CalendarGridBodyProps } from "./types"

const { child, children, ...rest }: CalendarGridBodyProps = $props()
const ctx = calendarHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().gridBody()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <tbody {...attrs(merged)}>{@render children?.()}</tbody>
{/if}
