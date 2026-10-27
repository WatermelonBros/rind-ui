<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timerContext, timerUnitContext } from "./context.svelte"
import type { TimerItemProps } from "./types"

const { type, child, children, ...rest }: TimerItemProps = $props()
const ctx = timerContext.get()
timerUnitContext.set(() => type)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(type)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
