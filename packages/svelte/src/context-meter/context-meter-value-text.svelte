<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { contextMeterContext } from "./context"
import type { ContextMeterValueTextProps } from "./types"

/** The short visible value ("17%"); its content replaces it. */
const { child, children, ...rest }: ContextMeterValueTextProps = $props()
const ctx = contextMeterContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valueTextPart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().shortText}{/if}</span>
{/if}
