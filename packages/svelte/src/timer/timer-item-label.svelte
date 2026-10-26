<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timerContext, useUnit } from "./context.svelte"
import type { TimerItemLabelProps } from "./types"

const { type, child, children, ...rest }: TimerItemLabelProps = $props()
const ctx = timerContext.get()
const unit = useUnit("ItemLabel", () => type)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().itemLabel(unit())), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
