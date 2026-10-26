<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timerContext } from "./context.svelte"
import type { TimerControlProps } from "./types"

const { child, children, ...rest }: TimerControlProps = $props()
const ctx = timerContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().control()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
