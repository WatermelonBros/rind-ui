<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timerContext } from "./context.svelte"
import type { TimerSeparatorProps } from "./types"

const { child, children, ...rest }: TimerSeparatorProps = $props()
const ctx = timerContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().separator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
