<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { timerContext, useUnit } from "./context.svelte"
import type { TimerItemValueProps } from "./types"

const { type, child, children, ...rest }: TimerItemValueProps = $props()
const ctx = timerContext.get()
const unit = useUnit("ItemValue", () => type)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().itemValue(unit())), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().text(unit())}{/if}</span>
{/if}
