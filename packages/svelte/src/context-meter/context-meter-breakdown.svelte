<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { contextMeterContext } from "./context"
import type { ContextMeterBreakdownProps } from "./types"

const { child, children, ...rest }: ContextMeterBreakdownProps = $props()
const ctx = contextMeterContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().breakdown()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <dl {...attrs(merged)}>{@render children?.(ctx.state())}</dl>
{/if}
