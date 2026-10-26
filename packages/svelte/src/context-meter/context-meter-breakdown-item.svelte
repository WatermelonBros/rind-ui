<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { contextMeterContext } from "./context"
import type { ContextMeterBreakdownItemProps } from "./types"

/** One `dt`/`dd` pair; `children` replace the pair. */
const { itemKey, label, amount, child, children, ...rest }: ContextMeterBreakdownItemProps =
  $props()
const ctx = contextMeterContext.get()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().breakdownItem(itemKey)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}<dt>{label}</dt><dd>{amount}</dd>{/if}</div>
{/if}
